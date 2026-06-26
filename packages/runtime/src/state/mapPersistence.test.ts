// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { RuntimeContext } from "../runtimeContext.js";
import { isMapSlotSnapshotKey, restoreMapSlots, serialiseMapSlots } from "./mapPersistence.js";
import { type MapStore, createMapStore } from "./mapStore.js";

function ctxWith(slots: ReadonlyArray<readonly [string, MapStore]>): RuntimeContext {
    return { mapSlots: new Map(slots) } as unknown as RuntimeContext;
}

describe("isMapSlotSnapshotKey", () => {
    it("matches only the :map suffix", () => {
        expect(isMapSlotSnapshotKey("a#0:map")).toBe(true);
        expect(isMapSlotSnapshotKey("dep:fast/a#0:map")).toBe(true);
        expect(isMapSlotSnapshotKey("a#0:state")).toBe(false);
        expect(isMapSlotSnapshotKey("a#0:series")).toBe(false);
        expect(isMapSlotSnapshotKey("a#0:array")).toBe(false);
        expect(isMapSlotSnapshotKey("ta:a#0")).toBe(false);
    });
});

describe("serialiseMapSlots", () => {
    it("emits JSON-clean entry tuples carrying capacity + both maps", () => {
        const slot = createMapStore(4);
        slot.handle.set("a", 1);
        slot.handle.set(2, 0);
        slot.onBarClose();
        slot.handle.set("b", 3);
        const entry = serialiseMapSlots(ctxWith([["a:map", slot]]))["a:map"] as Record<
            string,
            unknown
        >;
        expect(entry.kind).toBe("state.map");
        expect(entry.capacity).toBe(4);
        // Committed has the two close-time entries; string + number keys preserved.
        expect(entry.committed).toEqual([
            ["a", 1],
            [2, 0],
        ]);
        expect(entry.tentative).toEqual([
            ["a", 1],
            [2, 0],
            ["b", 3],
        ]);
    });

    it("serialises a non-finite value as null", () => {
        const slot = createMapStore(4);
        slot.handle.set("a", Number.NaN);
        const entry = serialiseMapSlots(ctxWith([["a:map", slot]]))["a:map"] as Record<
            string,
            unknown
        >;
        expect(entry.tentative).toEqual([["a", null]]);
    });
});

describe("restoreMapSlots", () => {
    it("round-trips committed + tentative maps preserving insertion order + key types", () => {
        const original = createMapStore(4);
        original.handle.set("a", 1);
        original.handle.set(2, 2);
        original.onBarClose(); // committed = {a:1, 2:2}
        original.handle.set("c", 3); // tentative diverges
        const snapshot = serialiseMapSlots(ctxWith([["a:map", original]]));

        const target = ctxWith([]);
        restoreMapSlots(target, snapshot);
        const restored = target.mapSlots.get("a:map");
        expect(restored?.capacity).toBe(4);
        expect(restored?.handle.size).toBe(3);
        expect(restored?.handle.get("c")).toBe(3);
        // Insertion order survives.
        expect(restored?.handle.keyAt(0)).toBe("a");
        expect(restored?.handle.keyAt(1)).toBe(2);
        expect(restored?.handle.keyAt(2)).toBe("c");
        // Committed map rolled back via onBarTick.
        restored?.onBarTick();
        expect(restored?.handle.size).toBe(2);
        expect(restored?.handle.has("c")).toBe(false);
    });

    it("rehydrates a null-marked value back to NaN", () => {
        const target = ctxWith([]);
        restoreMapSlots(target, {
            "a:map": {
                kind: "state.map",
                capacity: 4,
                committed: [["a", null]],
                tentative: [["a", null]],
            },
        });
        expect(target.mapSlots.get("a:map")?.handle.get("a")).toBeNaN();
    });

    it("ignores non-map keys and skips malformed entries", () => {
        const target = ctxWith([]);
        restoreMapSlots(target, {
            "x:state": { committed: 1, tentative: 1 },
            "notRecord:map": 7,
            "wrongKind:map": { kind: "ta.ema" },
            "nonIntCapacity:map": {
                kind: "state.map",
                capacity: 1.5,
                committed: [],
                tentative: [],
            },
            "zeroCapacity:map": {
                kind: "state.map",
                capacity: 0,
                committed: [],
                tentative: [],
            },
            "nonArraySection:map": {
                kind: "state.map",
                capacity: 4,
                committed: "nope",
                tentative: [],
            },
            "overCapacity:map": {
                kind: "state.map",
                capacity: 1,
                committed: [
                    ["a", 1],
                    ["b", 2],
                ],
                tentative: [],
            },
            "badEntryShape:map": {
                kind: "state.map",
                capacity: 4,
                committed: [["a"]],
                tentative: [],
            },
            "badKeyType:map": {
                kind: "state.map",
                capacity: 4,
                committed: [[true, 1]],
                tentative: [],
            },
            "badValue:map": {
                kind: "state.map",
                capacity: 4,
                committed: [["a", "nope"]],
                tentative: [],
            },
            "badTentative:map": {
                kind: "state.map",
                capacity: 4,
                committed: [["a", 1]],
                tentative: "nope",
            },
        });
        expect(target.mapSlots.size).toBe(0);
    });

    it("loads cleanly when no map section is present (clears prior slots)", () => {
        const target = ctxWith([["stale:map", createMapStore(4)]]);
        restoreMapSlots(target, { "x:state": { committed: 1, tentative: 1 } });
        expect(target.mapSlots.size).toBe(0);
    });
});
