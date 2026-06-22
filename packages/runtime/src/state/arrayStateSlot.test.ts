// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import {
    ArrayStateSlot,
    buildArrayHandle,
    createArrayStateSlot,
    restoreArrayStateSlot,
} from "./arrayStateSlot.js";

describe("ArrayStateSlot handle", () => {
    it("push then read newest via get(0) / last() / size", () => {
        const slot = createArrayStateSlot(4);
        expect(slot.handle.size).toBe(0);
        expect(slot.handle.get(0)).toBeNaN();
        expect(slot.handle.last()).toBeNaN();

        slot.handle.push(1);
        slot.handle.push(2);
        expect(slot.handle.size).toBe(2);
        expect(slot.handle.get(0)).toBe(2);
        expect(slot.handle.last()).toBe(2);
        expect(slot.handle.get(1)).toBe(1);
    });

    it("FIFO-evicts the oldest once capacity is reached", () => {
        const slot = createArrayStateSlot(3);
        slot.handle.push(1);
        slot.handle.push(2);
        slot.handle.push(3);
        slot.handle.push(4); // evicts 1
        expect(slot.handle.size).toBe(3);
        expect(slot.handle.get(0)).toBe(4);
        expect(slot.handle.get(2)).toBe(2);
        // get(capacity) is out of range → NaN, never the evicted value.
        expect(slot.handle.get(3)).toBeNaN();
    });

    it("get(n) for n < 0 returns NaN", () => {
        const slot = createArrayStateSlot(2);
        slot.handle.push(7);
        expect(slot.handle.get(-1)).toBeNaN();
    });

    it("clear() empties the collection", () => {
        const slot = createArrayStateSlot(4);
        slot.handle.push(1);
        slot.handle.push(2);
        slot.handle.clear();
        expect(slot.handle.size).toBe(0);
        expect(slot.handle.get(0)).toBeNaN();
    });

    it("capacity getter is the constructor value", () => {
        expect(createArrayStateSlot(20).handle.capacity).toBe(20);
    });

    it("handle identity is stable (built once)", () => {
        const slot = createArrayStateSlot(2);
        expect(slot.handle).toBe(slot.handle);
        expect(buildArrayHandle(slot)).not.toBe(slot.handle);
    });
});

describe("ArrayStateSlot two-ring discipline", () => {
    it("onBarClose commits tentative into committed", () => {
        const slot = new ArrayStateSlot(4);
        slot.handle.push(1);
        slot.handle.push(2);
        slot.onBarClose();
        expect(slot.committedRing.at(0)).toBe(2);
        expect(slot.committedRing.length).toBe(2);
    });

    it("onBarTick rolls tentative back to committed (discards in-progress pushes)", () => {
        const slot = new ArrayStateSlot(4);
        slot.handle.push(1);
        slot.onBarClose(); // committed = [1]
        slot.handle.push(2); // tentative = [1, 2]
        slot.onBarTick(); // discard the 2
        expect(slot.handle.size).toBe(1);
        expect(slot.handle.get(0)).toBe(1);
    });

    it("a tentative clear() is rolled back by onBarTick", () => {
        const slot = new ArrayStateSlot(4);
        slot.handle.push(5);
        slot.onBarClose();
        slot.handle.clear();
        expect(slot.handle.size).toBe(0);
        slot.onBarTick();
        expect(slot.handle.size).toBe(1);
        expect(slot.handle.get(0)).toBe(5);
    });
});

describe("restoreArrayStateSlot", () => {
    it("rebuilds both rings from restored buffers, recreating handle identity", () => {
        const original = new ArrayStateSlot(4);
        original.handle.push(1);
        original.handle.push(2);
        original.onBarClose();
        original.handle.push(3); // tentative diverges from committed

        const restored = restoreArrayStateSlot(original.committedRing, original.tentativeRing);
        expect(restored.capacity).toBe(4);
        expect(restored.handle).not.toBe(original.handle);
        // Tentative ring is the author-facing read surface.
        expect(restored.handle.get(0)).toBe(3);
        expect(restored.handle.size).toBe(3);
        // Committed ring rolled back via onBarTick proves the committed copy.
        restored.onBarTick();
        expect(restored.handle.size).toBe(2);
        expect(restored.handle.get(0)).toBe(2);
    });
});
