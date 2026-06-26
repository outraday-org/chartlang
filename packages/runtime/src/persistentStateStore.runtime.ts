// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    JsonValue,
    RunnerSnapshot,
    StateSnapshot,
    StreamSnapshot,
} from "@invinite-org/chartlang-core";

import type { RunnerState } from "./createScriptRunner.js";
import { pushDiagnostic } from "./emit/index.js";
import { validateSnapshot } from "./persistentStateStore.validate.js";
import type { RuntimeContext } from "./runtimeContext.js";
import {
    isArraySlotSnapshotKey,
    isMapSlotSnapshotKey,
    isSeriesSlotSnapshotKey,
    restoreArraySlots,
    restoreMapSlots,
    restoreSeriesSlots,
    restoreStateSlots,
    serialiseArraySlots,
    serialiseMapSlots,
    serialiseSeriesSlots,
    serialiseStateSlots,
} from "./state/index.js";
import { isTaSlotSnapshotKey, restoreTaSlots, serialiseTaSlots } from "./ta/persistence.js";

/**
 * Default PLAN §6.9 write cadence for persistent snapshots.
 *
 * @since 0.5
 * @internal
 * @example
 *     const stale = Date.now() - PERSISTENCE_INTERVAL_MS;
 *     void stale;
 */
export const PERSISTENCE_INTERVAL_MS = 60_000;

function firstStreamKey(snapshot: StateSnapshot): string | null {
    const entries = Object.entries(snapshot.streams);
    const first = entries[0];
    return first === undefined ? null : first[0];
}

function captureStreams(state: RunnerState): Readonly<Record<string, StreamSnapshot>> {
    const main = state.mainStream.serialiseSnapshot();
    const streams: Record<string, StreamSnapshot> = {
        [main.interval === "" ? "main" : main.interval]: main,
    };
    for (const [key, stream] of state.runtimeContext.secondaryStreams) {
        streams[key] = stream.serialiseSnapshot();
    }
    return Object.freeze(streams);
}

function primarySectionSlots(state: RunnerState): Readonly<Record<string, JsonValue>> {
    return Object.freeze({
        ...serialiseStateSlots(state.runtimeContext),
        ...serialiseSeriesSlots(state.runtimeContext),
        ...serialiseArraySlots(state.runtimeContext),
        ...serialiseMapSlots(state.runtimeContext),
        ...serialiseTaSlots(state.mainStream),
    } as Record<string, JsonValue>);
}

function runnerSection(ctx: RuntimeContext): RunnerSnapshot {
    return Object.freeze({
        slots: Object.freeze({
            ...serialiseStateSlots(ctx),
            ...serialiseSeriesSlots(ctx),
            ...serialiseArraySlots(ctx),
            ...serialiseMapSlots(ctx),
        } as Record<string, JsonValue>),
    });
}

function captureSiblings(state: RunnerState): Readonly<Record<string, RunnerSnapshot>> | undefined {
    if (state.siblingRunners.length === 0) return undefined;
    const out: Record<string, RunnerSnapshot> = {};
    for (const sibling of state.siblingRunners) {
        out[sibling.exportName] = runnerSection(sibling.state.runtimeContext);
    }
    return Object.freeze(out);
}

function captureDependencies(
    state: RunnerState,
): Readonly<Record<string, RunnerSnapshot>> | undefined {
    if (state.depRunners.length === 0) return undefined;
    const out: Record<string, RunnerSnapshot> = {};
    for (const dep of state.depRunners) {
        out[dep.localId] = runnerSection(dep.state.runtimeContext);
    }
    return Object.freeze(out);
}

/**
 * Capture the runner's current stream + per-runner state-slot snapshot.
 *
 * Returns the structured shape carrying `primary.slots`, optional
 * `siblings[exportName].slots`, and optional `dependencies[localId].slots`.
 * TA slots live in `primary.slots` because the bundle's deps and siblings
 * share the primary's `mainStream` (Task-4 invariant).
 *
 * @since 0.5 — widened to per-runner sections in 0.7.
 * @internal
 * @example
 *     // const snapshot = captureStateSnapshot(state, Date.now());
 *     const captured = true;
 *     void captured;
 */
export function captureStateSnapshot(state: RunnerState, savedAt: number): StateSnapshot | null {
    const streams = captureStreams(state);
    const siblings = captureSiblings(state);
    const dependencies = captureDependencies(state);
    const candidate: StateSnapshot = {
        lastBarTime: state.mainStream.bar.time,
        streams,
        savedAt,
        snapshotVersion: 1,
        primary: { slots: primarySectionSlots(state) },
        ...(siblings === undefined ? {} : { siblings }),
        ...(dependencies === undefined ? {} : { dependencies }),
    };
    if (!validateSnapshot(candidate)) return null;
    return candidate;
}

// Phase-1 mounts have `bar.interval === ""` until the first bar lands; in that
// window the snapshot is keyed by whatever captureStreams used ("main" or the
// explicit interval). Fall back to the snapshot's first-entered stream so warm
// restart still finds the buffer.
function resolveMainStreamSnapshot(
    snapshot: StateSnapshot,
    mainInterval: string,
): StreamSnapshot | undefined {
    const direct = mainInterval === "" ? undefined : snapshot.streams[mainInterval];
    if (direct !== undefined) return direct;
    const fallback = firstStreamKey(snapshot);
    return fallback === null ? undefined : snapshot.streams[fallback];
}

// Scalar `state.*` keys only — strip `ta:` (restored onto the stream),
// `:series` (restored into `ctx.seriesSlots`), `:array` (restored into
// `ctx.arraySlots`), and `:map` (restored into `ctx.mapSlots`) so the scalar
// slot store receives none of them.
function scalarStateSlots(slots: Readonly<Record<string, unknown>>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [slotKey, value] of Object.entries(slots)) {
        if (
            !isTaSlotSnapshotKey(slotKey) &&
            !isSeriesSlotSnapshotKey(slotKey) &&
            !isArraySlotSnapshotKey(slotKey) &&
            !isMapSlotSnapshotKey(slotKey)
        ) {
            out[slotKey] = value;
        }
    }
    return out;
}

// Restore a runner's scalar `state.*` slots and `state.series` slots from
// one merged `slots` record. Series rings are sized to the runner's current
// ring capacity (the close buffer's capacity).
function restoreRunnerSlots(
    ctx: RuntimeContext,
    slots: Readonly<Record<string, unknown>>,
    capacity: number,
): void {
    restoreStateSlots(ctx, scalarStateSlots(slots));
    restoreSeriesSlots(ctx, slots, capacity);
    restoreArraySlots(ctx, slots);
    restoreMapSlots(ctx, slots);
}

function pushMalformedSection(state: RunnerState, message: string): void {
    pushDiagnostic(state.emissions, {
        kind: "diagnostic",
        severity: "warning",
        code: "state-snapshot-malformed",
        message,
        slotId: null,
        bar: state.barIndex,
    });
}

function restoreSiblingSections(
    state: RunnerState,
    siblings: Readonly<Record<string, RunnerSnapshot>>,
): void {
    const lookup = new Map(state.siblingRunners.map((sib) => [sib.exportName, sib]));
    for (const [exportName, section] of Object.entries(siblings)) {
        const sibling = lookup.get(exportName);
        if (sibling === undefined) {
            pushMalformedSection(
                state,
                `persistent state snapshot referenced unknown sibling "${exportName}"`,
            );
            continue;
        }
        restoreRunnerSlots(
            sibling.state.runtimeContext,
            section.slots,
            state.mainStream.ohlcv.close.capacity,
        );
    }
}

function restoreDependencySections(
    state: RunnerState,
    dependencies: Readonly<Record<string, RunnerSnapshot>>,
): void {
    const lookup = new Map(state.depRunners.map((dep) => [dep.localId, dep]));
    for (const [localId, section] of Object.entries(dependencies)) {
        const dep = lookup.get(localId);
        if (dep === undefined) {
            pushMalformedSection(
                state,
                `persistent state snapshot referenced unknown dependency "${localId}"`,
            );
            continue;
        }
        restoreRunnerSlots(
            dep.state.runtimeContext,
            section.slots,
            state.mainStream.ohlcv.close.capacity,
        );
    }
}

/**
 * Restore a validated snapshot into the runner's stream + slot stores.
 *
 * Walks every per-runner section: `primary.slots` rehydrates the
 * primary's `state.*` slots (and TA slots on the shared mainStream);
 * `siblings[exportName].slots` and `dependencies[localId].slots`
 * rehydrate each matching sub-runner. Snapshot sections whose id is not
 * declared by the current bundle are skipped with a
 * `state-snapshot-malformed` diagnostic.
 *
 * Legacy flat-shape snapshots (pre-0.7) restore into the primary only.
 *
 * @since 0.5 — widened to per-runner sections in 0.7.
 * @internal
 * @example
 *     // restoreStateSnapshot(state, snapshot);
 *     const restored = true;
 *     void restored;
 */
export function restoreStateSnapshot(state: RunnerState, snapshot: StateSnapshot): void {
    const stream = resolveMainStreamSnapshot(snapshot, state.mainStream.bar.interval);
    if (stream !== undefined) {
        state.mainStream.restoreFromSnapshot(stream);
        state.barIndex = Math.max(state.barIndex, stream.filled);
    }
    for (const [secondaryKey, secondary] of state.runtimeContext.secondaryStreams) {
        const secondarySnapshot = snapshot.streams[secondaryKey];
        if (secondarySnapshot !== undefined) {
            secondary.restoreFromSnapshot(secondarySnapshot);
        }
    }

    const primarySlots = primarySlotsOf(snapshot);
    restoreTaSlots(state.mainStream, primarySlots);
    restoreRunnerSlots(state.runtimeContext, primarySlots, state.mainStream.ohlcv.close.capacity);

    if (snapshot.siblings !== undefined) {
        restoreSiblingSections(state, snapshot.siblings);
    }
    if (snapshot.dependencies !== undefined) {
        restoreDependencySections(state, snapshot.dependencies);
    }
}

/**
 * Resolve the primary runner's slot map from either the structured shape
 * (`snapshot.primary.slots`) or the legacy flat shape (`snapshot.slots`).
 * The validator accepts both but the strict `StateSnapshot` type only
 * mirrors the structured shape; the dual shape is read through this
 * legacy-aware view. {@link validateSnapshot} guarantees at least one of
 * the two shapes is present so we never fall through.
 *
 * @internal
 */
type LegacySnapshotView = Readonly<{
    readonly primary?: RunnerSnapshot;
    readonly slots?: Readonly<Record<string, JsonValue>>;
}>;

const EMPTY_SLOTS: Readonly<Record<string, JsonValue>> = Object.freeze({});

function primarySlotsOf(snapshot: StateSnapshot): Readonly<Record<string, JsonValue>> {
    const view = snapshot as LegacySnapshotView;
    if (view.primary !== undefined) return view.primary.slots;
    /* c8 ignore next 2 — validateSnapshot guarantees one of primary/slots is present. */
    if (view.slots === undefined) return EMPTY_SLOTS;
    return view.slots;
}

/**
 * Save one snapshot and convert malformed/save failures into diagnostics.
 *
 * @since 0.5
 * @internal
 * @example
 *     // await saveStateSnapshot(state, Date.now());
 *     const saved = true;
 *     void saved;
 */
export async function saveStateSnapshot(state: RunnerState, savedAt: number): Promise<boolean> {
    const store = state.runtimeContext.persistentStateStore;
    if (store === undefined) return false;
    const snapshot = captureStateSnapshot(state, savedAt);
    if (snapshot === null) {
        pushDiagnostic(state.emissions, {
            kind: "diagnostic",
            severity: "warning",
            code: "state-snapshot-malformed",
            message: "persistent state snapshot was not JSON-clean",
            slotId: null,
            bar: state.barIndex,
        });
        return false;
    }
    try {
        await store.save(snapshot);
        state.runtimeContext.lastPersistTime = savedAt;
        return true;
    } catch (err) {
        pushDiagnostic(state.emissions, {
            kind: "diagnostic",
            severity: "warning",
            code: "state-snapshot-save-failed",
            message: err instanceof Error ? err.message : String(err),
            slotId: null,
            bar: state.barIndex,
        });
        return false;
    }
}

/**
 * Save when the configured PLAN §6.9 wall-clock cadence is stale.
 *
 * @since 0.5
 * @internal
 * @example
 *     // await maybeSaveStateSnapshot(state, Date.now(), 60_000);
 *     const maybe = true;
 *     void maybe;
 */
export async function maybeSaveStateSnapshot(
    state: RunnerState,
    savedAt: number,
    intervalMs: number,
): Promise<void> {
    if (state.runtimeContext.persistentStateStore === undefined) return;
    if (savedAt - state.runtimeContext.lastPersistTime >= intervalMs) {
        await saveStateSnapshot(state, savedAt);
    }
}
