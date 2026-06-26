// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { JsonValue } from "@invinite-org/chartlang-core";

import { finiteOrNull, isInteger, isRecord, restoreNumber } from "../bufferSnapshot.js";
import type { RuntimeContext } from "../runtimeContext.js";
import type { MapKey, MapStore } from "./mapStore.js";
import { restoreMapStore } from "./mapStore.js";

const MAP_SLOT_SUFFIX = ":map";

/**
 * Return whether a snapshot slot key belongs to the `state.map` namespace (a
 * `${slotIdPrefix}${slotId}:map` key). Lets the restore router separate map
 * slots from scalar `state.*` (`:state`), `state.series` (`:series`),
 * `state.array` (`:array`), and `ta.*` (`ta:`) slots, all of which share one
 * `slots` record.
 *
 * @since 1.4
 * @internal
 * @stable
 * @example
 *     isMapSlotSnapshotKey("x.chart.ts:1:1:map"); // true
 */
export function isMapSlotSnapshotKey(key: string): boolean {
    return key.endsWith(MAP_SLOT_SUFFIX);
}

// Serialise one map into JSON-clean insertion-ordered `[key, value]` entry
// tuples. Entry tuples (not a `Record`) preserve the `string` vs `number` key
// distinction — a JS object would stringify a number key. A non-finite value
// (`NaN` / `±Infinity`) rides as `null` so the snapshot validator accepts it.
function serialiseMapEntries(store: Map<MapKey, number>): JsonValue {
    const entries: JsonValue[] = [];
    for (const [key, value] of store) {
        entries.push([key, finiteOrNull(value)]);
    }
    return entries;
}

/**
 * Serialise the runner's `state.map` slots into JSON-clean snapshot entries
 * keyed by the same `${prefix}${slotId}:map` key the slot store uses. Both maps
 * ride {@link serialiseMapEntries}; `capacity` is recorded so restore can detect
 * a script-edited capacity and degrade.
 *
 * @since 1.4
 * @internal
 * @stable
 * @example
 *     // const entries = serialiseMapSlots(ctx);
 *     const entries = {};
 *     void entries;
 */
export function serialiseMapSlots(ctx: RuntimeContext): Readonly<Record<string, JsonValue>> {
    const out: Record<string, JsonValue> = {};
    for (const [key, slot] of ctx.mapSlots.entries()) {
        out[key] = {
            kind: "state.map",
            capacity: slot.capacity,
            committed: serialiseMapEntries(slot.committedMap),
            tentative: serialiseMapEntries(slot.tentativeMap),
        };
    }
    return Object.freeze(out);
}

// Rebuild a `Map<MapKey, number>` from a serialised entry-tuple section, sized
// to `capacity`. Returns `null` (→ the whole slot degrades to fresh) on any
// malformed shape: a non-array section, an over-capacity entry count, a
// non-`[k, v]` entry, a non-`string|number` key, or a value that is neither a
// finite number nor the `null` NaN-marker.
function restoreMapEntries(value: unknown, capacity: number): Map<MapKey, number> | null {
    if (!Array.isArray(value) || value.length > capacity) return null;
    const map = new Map<MapKey, number>();
    for (const entry of value) {
        if (!Array.isArray(entry) || entry.length !== 2) return null;
        const [key, rawValue] = entry;
        if (typeof key !== "string" && typeof key !== "number") return null;
        const restored = restoreNumber(rawValue);
        if (restored === null) return null;
        map.set(key, restored);
    }
    return map;
}

function restoreMapSnapshot(snapshot: unknown): MapStore | null {
    if (!isRecord(snapshot) || snapshot.kind !== "state.map") return null;
    if (!isInteger(snapshot.capacity) || snapshot.capacity <= 0) return null;
    const committedMap = restoreMapEntries(snapshot.committed, snapshot.capacity);
    const tentativeMap = restoreMapEntries(snapshot.tentative, snapshot.capacity);
    if (committedMap === null || tentativeMap === null) return null;
    return restoreMapStore(snapshot.capacity, committedMap, tentativeMap);
}

/**
 * Restore `state.map` slots from namespaced snapshot entries into
 * `ctx.mapSlots`, rebuilding each map at the *persisted* `capacity` in insertion
 * order. Non-map keys are ignored; a malformed snapshot — or one whose entry
 * count exceeds its recorded `capacity` — is skipped so the slot starts fresh (a
 * script-edited `state.map(cap)` literal degrades, it does not throw). The handle
 * identity is recreated on restore (acceptable — same as `state.array`).
 *
 * @since 1.4
 * @internal
 * @stable
 * @example
 *     // restoreMapSlots(ctx, snapshot.slots);
 *     const restored = true;
 *     void restored;
 */
export function restoreMapSlots(
    ctx: RuntimeContext,
    slots: Readonly<Record<string, unknown>>,
): void {
    ctx.mapSlots.clear();
    for (const [key, value] of Object.entries(slots)) {
        if (!isMapSlotSnapshotKey(key)) continue;
        const slot = restoreMapSnapshot(value);
        if (slot !== null) {
            ctx.mapSlots.set(key, slot);
        }
    }
}
