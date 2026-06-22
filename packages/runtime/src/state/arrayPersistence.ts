// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { JsonValue } from "@invinite-org/chartlang-core";

import {
    isBufferSnapshot,
    isInteger,
    isRecord,
    restoreBuffer,
    serialiseBuffer,
} from "../bufferSnapshot.js";
import type { RuntimeContext } from "../runtimeContext.js";
import type { ArrayStateSlot } from "./arrayStateSlot.js";
import { restoreArrayStateSlot } from "./arrayStateSlot.js";

const ARRAY_SLOT_SUFFIX = ":array";

/**
 * Return whether a snapshot slot key belongs to the `state.array` namespace
 * (a `${slotIdPrefix}${slotId}:array` key). Lets the restore router separate
 * array slots from scalar `state.*` (`:state`), `state.series` (`:series`), and
 * `ta.*` (`ta:`) slots, all of which share one `slots` record.
 *
 * @since 1.3
 * @internal
 * @stable
 * @example
 *     isArraySlotSnapshotKey("x.chart.ts:1:1:array"); // true
 */
export function isArraySlotSnapshotKey(key: string): boolean {
    return key.endsWith(ARRAY_SLOT_SUFFIX);
}

/**
 * Serialise the runner's `state.array` slots into JSON-clean snapshot entries
 * keyed by the same `${prefix}${slotId}:array` key the slot store uses. Both
 * rings ride {@link Float64RingBuffer.serialiseSnapshotBuffer}; `capacity` is
 * recorded so restore can detect a script-edited capacity and degrade.
 *
 * @since 1.3
 * @internal
 * @stable
 * @example
 *     // const entries = serialiseArraySlots(ctx);
 *     const entries = {};
 *     void entries;
 */
export function serialiseArraySlots(ctx: RuntimeContext): Readonly<Record<string, JsonValue>> {
    const out: Record<string, JsonValue> = {};
    for (const [key, slot] of ctx.arraySlots.entries()) {
        out[key] = {
            kind: "state.array",
            capacity: slot.capacity,
            committed: serialiseBuffer(slot.committedRing),
            tentative: serialiseBuffer(slot.tentativeRing),
        };
    }
    return Object.freeze(out);
}

function restoreArraySlotSnapshot(snapshot: unknown): ArrayStateSlot | null {
    if (!isRecord(snapshot) || snapshot.kind !== "state.array") return null;
    if (!isInteger(snapshot.capacity) || snapshot.capacity <= 0) return null;
    const { committed, tentative } = snapshot;
    if (!isBufferSnapshot(committed) || !isBufferSnapshot(tentative)) return null;
    const committedRing = restoreBuffer(committed, snapshot.capacity);
    const tentativeRing = restoreBuffer(tentative, snapshot.capacity);
    if (committedRing === null || tentativeRing === null) return null;
    return restoreArrayStateSlot(committedRing, tentativeRing);
}

/**
 * Restore `state.array` slots from namespaced snapshot entries into
 * `ctx.arraySlots`, rebuilding each ring at the *persisted* `capacity`. Non-array
 * keys are ignored; a malformed snapshot — or one whose ring shape no longer
 * matches its recorded `capacity` — is skipped so the slot starts fresh (a
 * script-edited `state.array(cap)` literal degrades, it does not throw). The
 * handle identity is recreated on restore (acceptable — same as `state.series`).
 *
 * @since 1.3
 * @internal
 * @stable
 * @example
 *     // restoreArraySlots(ctx, snapshot.slots);
 *     const restored = true;
 *     void restored;
 */
export function restoreArraySlots(
    ctx: RuntimeContext,
    slots: Readonly<Record<string, unknown>>,
): void {
    ctx.arraySlots.clear();
    for (const [key, value] of Object.entries(slots)) {
        if (!isArraySlotSnapshotKey(key)) continue;
        const slot = restoreArraySlotSnapshot(value);
        if (slot !== null) {
            ctx.arraySlots.set(key, slot);
        }
    }
}
