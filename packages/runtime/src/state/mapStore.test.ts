// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { MapStore, buildMapHandle, createMapStore, restoreMapStore } from "./mapStore.js";

describe("MapStore handle basics", () => {
    it("set / get / has / size / clear", () => {
        const slot = createMapStore(4);
        expect(slot.handle.size).toBe(0);
        expect(slot.handle.has(1)).toBe(false);
        expect(slot.handle.get(1)).toBeUndefined();

        slot.handle.set(1, 10);
        slot.handle.set("a", 20);
        expect(slot.handle.size).toBe(2);
        expect(slot.handle.has(1)).toBe(true);
        expect(slot.handle.get(1)).toBe(10);
        expect(slot.handle.get("a")).toBe(20);

        slot.handle.clear();
        expect(slot.handle.size).toBe(0);
        expect(slot.handle.get(1)).toBeUndefined();
    });

    it("get distinguishes absent (undefined) from a stored 0", () => {
        const slot = createMapStore(4);
        slot.handle.set(7, 0);
        expect(slot.handle.get(7)).toBe(0);
        expect(slot.handle.get(8)).toBeUndefined();
    });

    it("delete returns true when present, false when absent", () => {
        const slot = createMapStore(4);
        slot.handle.set(1, 10);
        expect(slot.handle.delete(1)).toBe(true);
        expect(slot.handle.has(1)).toBe(false);
        expect(slot.handle.delete(1)).toBe(false);
    });

    it("number and string keys are distinct", () => {
        const slot = createMapStore(4);
        slot.handle.set(1, 10);
        slot.handle.set("1", 20);
        expect(slot.handle.size).toBe(2);
        expect(slot.handle.get(1)).toBe(10);
        expect(slot.handle.get("1")).toBe(20);
    });

    it("handle identity is stable (built once)", () => {
        const slot = createMapStore(2);
        expect(slot.handle).toBe(slot.handle);
        expect(buildMapHandle(slot)).not.toBe(slot.handle);
    });
});

describe("MapStore insertion-order FIFO eviction", () => {
    it("evicts the oldest-inserted key when a new key arrives at capacity", () => {
        const slot = createMapStore(3);
        slot.handle.set("a", 1);
        slot.handle.set("b", 2);
        slot.handle.set("c", 3);
        slot.handle.set("d", 4); // evicts "a" (oldest)
        expect(slot.handle.size).toBe(3);
        expect(slot.handle.has("a")).toBe(false);
        expect(slot.handle.get("d")).toBe(4);
    });

    it("updating an existing key at capacity evicts nothing and keeps its age", () => {
        const slot = createMapStore(3);
        slot.handle.set("a", 1);
        slot.handle.set("b", 2);
        slot.handle.set("c", 3);
        slot.handle.set("a", 99); // update in place — no eviction, no re-age
        expect(slot.handle.size).toBe(3);
        expect(slot.handle.get("a")).toBe(99);
        // "a" is still oldest, so the next new key evicts "a", not "b".
        slot.handle.set("d", 4);
        expect(slot.handle.has("a")).toBe(false);
        expect(slot.handle.has("b")).toBe(true);
    });

    it("delete then re-set re-ages the key to newest", () => {
        const slot = createMapStore(3);
        slot.handle.set("a", 1);
        slot.handle.set("b", 2);
        slot.handle.set("c", 3);
        slot.handle.delete("b");
        slot.handle.set("b", 22); // b is now newest
        // The next new key over capacity evicts "a" (oldest), not the re-aged "b".
        slot.handle.set("d", 4);
        expect(slot.handle.has("a")).toBe(false);
        expect(slot.handle.has("b")).toBe(true);
        expect(slot.handle.get("b")).toBe(22);
    });

    it("a capacity-0 store accepts nothing (degenerate, never throws)", () => {
        // The compiler guard rejects capacity <= 0, so the runtime never
        // allocates this — but the handle must degrade cleanly, exercising the
        // empty-store eviction branch.
        const slot = new MapStore(0);
        slot.handle.set("a", 1);
        expect(slot.handle.size).toBe(0);
        expect(slot.handle.get("a")).toBeUndefined();
    });
});

describe("MapStore keyAt", () => {
    it("returns keys in insertion order (0 = oldest)", () => {
        const slot = createMapStore(4);
        slot.handle.set("a", 1);
        slot.handle.set("b", 2);
        slot.handle.set("c", 3);
        expect(slot.handle.keyAt(0)).toBe("a");
        expect(slot.handle.keyAt(1)).toBe("b");
        expect(slot.handle.keyAt(2)).toBe("c");
    });

    it("returns undefined out of range (negative and >= size)", () => {
        const slot = createMapStore(4);
        slot.handle.set("a", 1);
        expect(slot.handle.keyAt(-1)).toBeUndefined();
        expect(slot.handle.keyAt(1)).toBeUndefined();
        expect(slot.handle.keyAt(0)).toBe("a");
    });
});

describe("MapStore two-snapshot discipline", () => {
    it("onBarClose commits the tentative map into committed", () => {
        const slot = new MapStore(4);
        slot.handle.set("a", 1);
        slot.handle.set("b", 2);
        slot.onBarClose();
        expect(slot.committedMap.get("a")).toBe(1);
        expect(slot.committedMap.size).toBe(2);
    });

    it("onBarTick rolls the tentative map back to committed (discards in-progress writes)", () => {
        const slot = new MapStore(4);
        slot.handle.set("a", 1);
        slot.onBarClose(); // committed = {a:1}
        slot.handle.set("b", 2); // tentative = {a:1, b:2}
        slot.onBarTick(); // discard the b
        expect(slot.handle.size).toBe(1);
        expect(slot.handle.has("b")).toBe(false);
        expect(slot.handle.get("a")).toBe(1);
    });

    it("a tentative clear() is rolled back by onBarTick", () => {
        const slot = new MapStore(4);
        slot.handle.set("a", 5);
        slot.onBarClose();
        slot.handle.clear();
        expect(slot.handle.size).toBe(0);
        slot.onBarTick();
        expect(slot.handle.size).toBe(1);
        expect(slot.handle.get("a")).toBe(5);
    });
});

describe("restoreMapStore", () => {
    it("rebuilds both maps from clones, recreating handle identity", () => {
        const committed = new Map<string, number>([["a", 1]]);
        const tentative = new Map<string, number>([
            ["a", 1],
            ["b", 2],
        ]);
        const slot = restoreMapStore(4, committed, tentative);
        expect(slot.capacity).toBe(4);
        expect(slot.handle.size).toBe(2);
        expect(slot.handle.get("b")).toBe(2);
        // The clone is independent of the caller's source maps.
        tentative.set("c", 3);
        expect(slot.handle.has("c")).toBe(false);
        // Committed map rolled back via onBarTick proves the committed copy.
        slot.onBarTick();
        expect(slot.handle.size).toBe(1);
        expect(slot.handle.get("a")).toBe(1);
    });
});
