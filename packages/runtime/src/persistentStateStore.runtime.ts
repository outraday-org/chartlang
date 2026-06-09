// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { StateSnapshot, StreamSnapshot } from "@invinite-org/chartlang-core";

import type { RunnerState } from "./createScriptRunner";
import { pushDiagnostic } from "./emit";
import { validateSnapshot } from "./persistentStateStore.validate";
import { restoreStateSlots, serialiseStateSlots } from "./state";
import { isTaSlotSnapshotKey, restoreTaSlots, serialiseTaSlots } from "./ta/persistence";

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

/**
 * Capture the runner's current stream and state-slot snapshot.
 *
 * @since 0.5
 * @internal
 * @example
 *     // const snapshot = captureStateSnapshot(state, Date.now());
 *     const captured = true;
 *     void captured;
 */
export function captureStateSnapshot(state: RunnerState, savedAt: number): StateSnapshot | null {
    const streams = captureStreams(state);
    const slots = {
        ...serialiseStateSlots(state.runtimeContext),
        ...serialiseTaSlots(state.mainStream),
    };
    const candidate = {
        lastBarTime: state.mainStream.bar.time,
        streams,
        slots: Object.freeze(slots),
        savedAt,
        snapshotVersion: 1,
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

/**
 * Restore a validated snapshot into the runner's stream and slot store.
 *
 * @since 0.5
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
    restoreTaSlots(state.mainStream, snapshot.slots);
    // Non-TA slots: everything not under the ta: namespace persists as
    // generic state.* slot data.
    const stateSlots: Record<string, unknown> = {};
    for (const [slotKey, value] of Object.entries(snapshot.slots)) {
        if (!isTaSlotSnapshotKey(slotKey)) {
            stateSlots[slotKey] = value;
        }
    }
    restoreStateSlots(state.runtimeContext, stateSlots);
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
