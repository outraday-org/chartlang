// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { ObjectRingBuffer } from "../ringBuffer.js";
import {
    advanceObjectSeriesSlot,
    commitObjectSeriesSlot,
    createObjectSeriesSlot,
    makeObjectSeriesSlotView,
    resetObjectSeriesSlotHead,
    restoreObjectSeriesSlot,
} from "./objectSeriesSlot.js";

describe("makeObjectSeriesSlotView (bool)", () => {
    it("reads the live head through value / current / [0] / coercion", () => {
        const buffer = new ObjectRingBuffer<boolean>(8, false);
        buffer.append(false);
        const view = makeObjectSeriesSlotView(buffer);

        view.value = true;
        expect(view.value).toBe(true);
        expect(view[0]).toBe(true);
        expect(view.current).toBe(true);
        expect(view.length).toBe(1);
    });

    it("reads committed history through [n] and the false default out of range", () => {
        const buffer = new ObjectRingBuffer<boolean>(8, false);
        const view = makeObjectSeriesSlotView(buffer);
        buffer.append(true);
        buffer.append(false);
        buffer.append(true);

        expect(view[0]).toBe(true);
        expect(view[1]).toBe(false);
        expect(view[2]).toBe(true);
        expect(view[3]).toBe(false); // out of range → default
        expect(view.length).toBe(3);
    });

    it("ignores writes to keys other than value and reads unknown keys as undefined", () => {
        const buffer = new ObjectRingBuffer<boolean>(4, false);
        buffer.append(true);
        const view = makeObjectSeriesSlotView(buffer) as unknown as Record<string, unknown>;

        expect(() => {
            (view as { other?: number }).other = 5;
        }).toThrow(TypeError);
        expect(view.other).toBeUndefined();
        expect(view.nope).toBeUndefined();
    });

    it("answers `has` for value, series keys, and rejects others", () => {
        const buffer = new ObjectRingBuffer<boolean>(4, false);
        buffer.append(true);
        const view = makeObjectSeriesSlotView(buffer);

        expect("value" in view).toBe(true);
        expect("current" in view).toBe(true);
        expect("length" in view).toBe(true);
        expect("0" in view).toBe(true);
        expect("nope" in view).toBe(false);
    });
});

describe("makeObjectSeriesSlotView (string)", () => {
    it("reads history and the empty-string default out of range", () => {
        const buffer = new ObjectRingBuffer<string>(8, "");
        const view = makeObjectSeriesSlotView(buffer);
        buffer.append("a");
        buffer.append("b");

        view.value = "B";
        expect(view[0]).toBe("B");
        expect(view[1]).toBe("a");
        expect(view[2]).toBe(""); // out of range → default
        expect(`${view}`).toBe("B"); // valueOf delegates to buf.at(0)
    });
});

describe("createObjectSeriesSlot", () => {
    it("seeds the live head with init and exposes a stable view identity", () => {
        const slot = createObjectSeriesSlot(
            new ObjectRingBuffer<string>(8, ""),
            "seed",
            "state.stringSeries",
        );
        expect(slot.kind).toBe("state.stringSeries");
        expect(slot.view[0]).toBe("seed");
        expect(slot.view.value).toBe("seed");
        expect(slot.committedHead).toBe("seed");
        expect(slot.view).toBe(slot.view);
    });
});

describe("restoreObjectSeriesSlot", () => {
    it("rebuilds a slot over an existing buffer with a recreated view", () => {
        const buffer = new ObjectRingBuffer<boolean>(8, false);
        buffer.append(false);
        buffer.append(true);
        const slot = restoreObjectSeriesSlot(buffer, false, "state.boolSeries");
        expect(slot.kind).toBe("state.boolSeries");
        expect(slot.view[0]).toBe(true);
        expect(slot.view[1]).toBe(false);
        expect(slot.committedHead).toBe(false);
    });
});

describe("advance / commit / resetHead", () => {
    it("advances with a default head, sliding the prior head to index 1", () => {
        const slot = createObjectSeriesSlot(
            new ObjectRingBuffer<boolean>(8, false),
            true,
            "state.boolSeries",
        );
        slot.view.value = true;
        commitObjectSeriesSlot(slot);

        advanceObjectSeriesSlot(slot);
        expect(slot.view[0]).toBe(false); // the element default, not NaN
        expect(slot.view[1]).toBe(true);
        expect(slot.view.length).toBe(2);
    });

    it("commit captures the live head; resetHead restores it for a tick", () => {
        const slot = createObjectSeriesSlot(
            new ObjectRingBuffer<string>(8, ""),
            "",
            "state.stringSeries",
        );
        slot.view.value = "close";
        commitObjectSeriesSlot(slot);
        expect(slot.committedHead).toBe("close");

        slot.view.value = "tick";
        expect(slot.view[0]).toBe("tick");
        resetObjectSeriesSlotHead(slot);
        expect(slot.view[0]).toBe("close");
    });
});
