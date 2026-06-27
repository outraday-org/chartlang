// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { isInteger, isRecord } from "../bufferSnapshot.js";
import { ObjectRingBuffer } from "../ringBuffer.js";
import type { RuntimeContext } from "../runtimeContext.js";
import {
    type ObjectSeriesKind,
    type ObjectSeriesSlot,
    restoreObjectSeriesSlot,
} from "./objectSeriesSlot.js";

// One suffix backs BOTH the bool and string series; the entry's `kind` field
// picks the element default on restore. `:objseries` cannot collide with the
// numeric `:series` suffix — the char before "series" is "j", not ":".
const OBJECT_SERIES_SLOT_SUFFIX = ":objseries";

// Per-kind element default + the runtime guard that validates a restored value.
// Defaults are the deterministic, host-invariant first-bar / out-of-range
// values from T12 Task 1: `false` for bool (Pine v6), `""` for string.
const ELEMENT_SPEC: Readonly<
    Record<
        ObjectSeriesKind,
        Readonly<{ default: boolean | string; isElement: (value: unknown) => boolean }>
    >
> = {
    "state.boolSeries": { default: false, isElement: (value) => typeof value === "boolean" },
    "state.stringSeries": { default: "", isElement: (value) => typeof value === "string" },
};

/**
 * Return whether a snapshot slot key belongs to a non-numeric `state.*Series`
 * namespace (a `${slotIdPrefix}${slotId}:objseries` key). Lets the restore
 * router separate these slots from scalar `state.*` (`:state`), numeric
 * `state.series` (`:series`), `state.array` (`:array`), `state.map` (`:map`),
 * and `ta.*` (`ta:`) slots, all of which share one `slots` record.
 *
 * @since 1.5
 * @internal
 * @stable
 * @example
 *     isObjectSeriesSlotSnapshotKey("x.chart.ts:1:1:objseries"); // true
 */
export function isObjectSeriesSlotSnapshotKey(key: string): boolean {
    return key.endsWith(OBJECT_SERIES_SLOT_SUFFIX);
}

/**
 * Serialise the runner's non-numeric series slots into JSON-clean snapshot
 * entries keyed by the same `${prefix}${slotId}:objseries` key the slot store
 * uses. `boolean` / `string` payloads are JSON-clean, so the ring's `values`
 * array and `committedHead` ride verbatim (no `NaN`→`null` mapping the numeric
 * buffer needs). The `kind` discriminator is recorded so restore can pick the
 * element default. Returns `unknown`-valued entries like
 * {@link serialiseStateSlots}; the snapshot-capture call site folds them into
 * the `JsonValue` record.
 *
 * @since 1.5
 * @internal
 * @stable
 * @example
 *     // const entries = serialiseObjectSeriesSlots(ctx);
 *     const entries = {};
 *     void entries;
 */
export function serialiseObjectSeriesSlots(ctx: RuntimeContext): Readonly<Record<string, unknown>> {
    const out: Record<string, unknown> = {};
    for (const [key, slot] of ctx.objectSeriesSlots.entries()) {
        const buffer = slot.buffer.serialiseSnapshotBuffer();
        out[key] = {
            kind: slot.kind,
            buffer: {
                headIndex: buffer.headIndex,
                filled: buffer.filled,
                values: [...buffer.values],
            },
            committedHead: slot.committedHead,
        };
    }
    return Object.freeze(out);
}

function restoreObjectSeriesSnapshot(
    snapshot: unknown,
    capacity: number,
): ObjectSeriesSlot<unknown> | null {
    if (!isRecord(snapshot)) return null;
    const kind = snapshot.kind;
    if (kind !== "state.boolSeries" && kind !== "state.stringSeries") return null;
    const spec = ELEMENT_SPEC[kind];
    const bufferSnapshot = snapshot.buffer;
    if (!isRecord(bufferSnapshot)) return null;
    if (!isInteger(bufferSnapshot.headIndex) || !isInteger(bufferSnapshot.filled)) return null;
    const values = bufferSnapshot.values;
    if (!Array.isArray(values) || !values.every(spec.isElement)) return null;
    if (!spec.isElement(snapshot.committedHead)) return null;
    const buffer = new ObjectRingBuffer<unknown>(capacity, spec.default);
    try {
        buffer.restoreFromSnapshotBuffer({
            headIndex: bufferSnapshot.headIndex,
            filled: bufferSnapshot.filled,
            values,
        });
    } catch {
        return null;
    }
    return restoreObjectSeriesSlot(buffer, snapshot.committedHead, kind);
}

/**
 * Restore non-numeric series slots from namespaced snapshot entries into
 * `ctx.objectSeriesSlots`, rebuilding each {@link ObjectRingBuffer} sized to the
 * runner's current `capacity` with the `kind`'s element default. Non-`:objseries`
 * keys are ignored; a malformed snapshot — wrong kind, a non-`boolean`/`string`
 * payload, or a capacity-incompatible ring — is skipped so the slot starts fresh
 * (it does not throw). The view identity is recreated on restore (acceptable —
 * same as the numeric series / `ta.*`).
 *
 * @since 1.5
 * @internal
 * @stable
 * @example
 *     // restoreObjectSeriesSlots(ctx, snapshot.slots, capacity);
 *     const restored = true;
 *     void restored;
 */
export function restoreObjectSeriesSlots(
    ctx: RuntimeContext,
    slots: Readonly<Record<string, unknown>>,
    capacity: number,
): void {
    ctx.objectSeriesSlots.clear();
    for (const [key, value] of Object.entries(slots)) {
        if (!isObjectSeriesSlotSnapshotKey(key)) continue;
        const slot = restoreObjectSeriesSnapshot(value, capacity);
        if (slot !== null) {
            ctx.objectSeriesSlots.set(key, slot);
        }
    }
}
