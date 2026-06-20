// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { Float64RingBuffer } from "../ringBuffer.js";
import {
    advanceSeriesSlot,
    commitSeriesSlot,
    createSeriesSlot,
    makeSeriesSlotView,
    resetSeriesSlotHead,
    restoreSeriesSlot,
} from "./seriesSlot.js";

describe("makeSeriesSlotView", () => {
    it("reads the live head through value / current / [0] / coercion", () => {
        const buffer = new Float64RingBuffer(8);
        buffer.append(3);
        const view = makeSeriesSlotView(buffer);

        view.value = 42;
        expect(view.value).toBe(42);
        expect(view[0]).toBe(42);
        expect(view.current).toBe(42);
        expect(+view).toBe(42);
        expect(`${view}`).toBe("42");
        expect(view.valueOf()).toBe(42);
        expect(view.length).toBe(1);
    });

    it("reads committed history through [n] and NaN out of range", () => {
        const buffer = new Float64RingBuffer(8);
        const view = makeSeriesSlotView(buffer);
        buffer.append(10);
        buffer.append(20);
        buffer.append(30);

        expect(view[0]).toBe(30);
        expect(view[1]).toBe(20);
        expect(view[2]).toBe(10);
        expect(view[3]).toBeNaN();
        expect(view.length).toBe(3);
    });

    it("ignores writes to keys other than value and reads unknown keys as undefined", () => {
        const buffer = new Float64RingBuffer(4);
        buffer.append(1);
        const view = makeSeriesSlotView(buffer) as unknown as Record<string, unknown>;

        // Non-`value` set is rejected by the trap (returns false → no write
        // in non-strict; the assignment expression below is a runtime no-op).
        expect(() => {
            (view as { other?: number }).other = 5;
        }).toThrow(TypeError);
        expect(view.other).toBeUndefined();
        expect(view.nope).toBeUndefined();
    });

    it("answers `has` for value, series keys, and rejects others", () => {
        const buffer = new Float64RingBuffer(4);
        buffer.append(1);
        const view = makeSeriesSlotView(buffer);

        expect("value" in view).toBe(true);
        expect("current" in view).toBe(true);
        expect("length" in view).toBe(true);
        expect("valueOf" in view).toBe(true);
        expect(Symbol.toPrimitive in view).toBe(true);
        expect("0" in view).toBe(true);
        expect("nope" in view).toBe(false);
    });
});

describe("createSeriesSlot", () => {
    it("seeds the live head with init and exposes a stable view identity", () => {
        const slot = createSeriesSlot(new Float64RingBuffer(8), 7);
        expect(slot.kind).toBe("state.series");
        expect(slot.view[0]).toBe(7);
        expect(slot.view.value).toBe(7);
        expect(slot.committedHead).toBe(7);
        expect(slot.view).toBe(slot.view);
    });
});

describe("restoreSeriesSlot", () => {
    it("rebuilds a slot over an existing buffer with a recreated view", () => {
        const buffer = new Float64RingBuffer(8);
        buffer.append(5);
        buffer.append(9);
        const slot = restoreSeriesSlot(buffer, 5);
        expect(slot.view[0]).toBe(9);
        expect(slot.view[1]).toBe(5);
        expect(slot.committedHead).toBe(5);
    });
});

describe("advance / commit / resetHead", () => {
    it("advances with a NaN head, sliding the prior head to index 1", () => {
        const slot = createSeriesSlot(new Float64RingBuffer(8), 1);
        slot.view.value = 10;
        commitSeriesSlot(slot);

        advanceSeriesSlot(slot);
        expect(slot.view[0]).toBeNaN();
        expect(slot.view[1]).toBe(10);
        expect(slot.view.length).toBe(2);
    });

    it("commit captures the live head; resetHead restores it for a tick", () => {
        const slot = createSeriesSlot(new Float64RingBuffer(8), 0);
        slot.view.value = 4;
        commitSeriesSlot(slot);
        expect(slot.committedHead).toBe(4);

        // A tick re-writes the head, then resetHead undoes it back to committed.
        slot.view.value = 99;
        expect(slot.view[0]).toBe(99);
        resetSeriesSlotHead(slot);
        expect(slot.view[0]).toBe(4);
    });
});
