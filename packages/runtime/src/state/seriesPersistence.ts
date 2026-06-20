// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { JsonValue } from "@invinite-org/chartlang-core";

import {
    finiteOrNull,
    isBufferSnapshot,
    isRecord,
    restoreBuffer,
    restoreNumber,
    serialiseBuffer,
} from "../bufferSnapshot.js";
import type { RuntimeContext } from "../runtimeContext.js";
import { restoreSeriesSlot, type SeriesSlot } from "./seriesSlot.js";

const SERIES_SLOT_SUFFIX = ":series";

/**
 * Return whether a snapshot slot key belongs to the `state.series`
 * namespace (a `${slotIdPrefix}${slotId}:series` key). Lets the restore
 * router separate series slots from scalar `state.*` (`:state`) and `ta.*`
 * (`ta:`) slots, all of which share one `slots` record.
 *
 * @since 0.9
 * @internal
 * @stable
 * @example
 *     isSeriesSlotSnapshotKey("x.chart.ts:1:1:series"); // true
 */
export function isSeriesSlotSnapshotKey(key: string): boolean {
    return key.endsWith(SERIES_SLOT_SUFFIX);
}

/**
 * Serialise the runner's `state.series` slots into JSON-clean snapshot
 * entries keyed by the same `${prefix}${slotId}:series` key the slot store
 * uses. `committedHead` is nulled when `NaN` (the validator rejects `NaN`);
 * the buffer rides {@link Float64RingBuffer.serialiseSnapshotBuffer}.
 *
 * @since 0.9
 * @internal
 * @stable
 * @example
 *     // const entries = serialiseSeriesSlots(ctx);
 *     const entries = {};
 *     void entries;
 */
export function serialiseSeriesSlots(ctx: RuntimeContext): Readonly<Record<string, JsonValue>> {
    const out: Record<string, JsonValue> = {};
    for (const [key, slot] of ctx.seriesSlots.entries()) {
        out[key] = {
            kind: "state.series",
            buffer: serialiseBuffer(slot.buffer),
            committedHead: finiteOrNull(slot.committedHead),
        };
    }
    return Object.freeze(out);
}

function restoreSeriesSlotSnapshot(snapshot: unknown, capacity: number): SeriesSlot | null {
    if (!isRecord(snapshot) || snapshot.kind !== "state.series") return null;
    const bufferSnapshot = snapshot.buffer;
    if (!isBufferSnapshot(bufferSnapshot)) return null;
    const committedHead = restoreNumber(snapshot.committedHead);
    if (committedHead === null) return null;
    const buffer = restoreBuffer(bufferSnapshot, capacity);
    if (buffer === null) return null;
    return restoreSeriesSlot(buffer, committedHead);
}

/**
 * Restore `state.series` slots from namespaced snapshot entries into
 * `ctx.seriesSlots`, rebuilding each ring via
 * {@link Float64RingBuffer.restoreFromSnapshotBuffer} sized to the runner's
 * current `capacity`. Non-series keys are ignored; malformed series
 * snapshots are skipped. The view identity is recreated on restore
 * (acceptable — same as `ta.*`).
 *
 * @since 0.9
 * @internal
 * @stable
 * @example
 *     // restoreSeriesSlots(ctx, snapshot.slots, capacity);
 *     const restored = true;
 *     void restored;
 */
export function restoreSeriesSlots(
    ctx: RuntimeContext,
    slots: Readonly<Record<string, unknown>>,
    capacity: number,
): void {
    ctx.seriesSlots.clear();
    for (const [key, value] of Object.entries(slots)) {
        if (!isSeriesSlotSnapshotKey(key)) continue;
        const slot = restoreSeriesSlotSnapshot(value, capacity);
        if (slot !== null) {
            ctx.seriesSlots.set(key, slot);
        }
    }
}
