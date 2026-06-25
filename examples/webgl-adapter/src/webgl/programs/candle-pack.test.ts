// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type {
    CandleBodiesDescriptor,
    CandleWicksDescriptor,
    RgbaUnit,
} from "../../layer-descriptor.js";
import {
    CANDLE_BODIES_OFFSET_CLOSE,
    CANDLE_BODIES_OFFSET_IDX,
    CANDLE_BODIES_OFFSET_IS_BULL,
    CANDLE_BODIES_OFFSET_OPEN,
    CANDLE_BODIES_STRIDE_BYTES,
    CANDLE_BODIES_STRIDE_FLOATS,
    CANDLE_WICKS_OFFSET_HIGH,
    CANDLE_WICKS_OFFSET_IDX,
    CANDLE_WICKS_OFFSET_IS_BULL,
    CANDLE_WICKS_OFFSET_LOW,
    CANDLE_WICKS_STRIDE_BYTES,
    CANDLE_WICKS_STRIDE_FLOATS,
    FLOAT_BYTES,
    packCandleBodies,
    packCandleWicks,
} from "./candle-pack.js";

const COLOR: RgbaUnit = [0.1, 0.2, 0.3, 1];

// Pack a bars list (`[x, open, high, low, close]`, `isBull` derived) into a
// bodies descriptor `rows` Float32Array — mirrors `buildFrame`'s pack.
function bodies(
    bars: ReadonlyArray<readonly [number, number, number, number, number]>,
): CandleBodiesDescriptor {
    const rows = new Float32Array(bars.length * CANDLE_BODIES_STRIDE_FLOATS);
    bars.forEach(([x, open, high, low, close], i) => {
        const o = i * CANDLE_BODIES_STRIDE_FLOATS;
        rows[o] = x;
        rows[o + 1] = open;
        rows[o + 2] = high;
        rows[o + 3] = low;
        rows[o + 4] = close;
        rows[o + 5] = close >= open ? 1 : 0;
    });
    return {
        bearColor: COLOR,
        bodyWidthPx: 6,
        bullColor: COLOR,
        id: "overlay:candle-bodies",
        kind: "candle-bodies",
        rowCount: bars.length,
        rows,
    };
}

function wicks(
    bars: ReadonlyArray<readonly [number, number, number, number]>,
): CandleWicksDescriptor {
    const rows = new Float32Array(bars.length * CANDLE_WICKS_STRIDE_FLOATS);
    bars.forEach(([x, low, high, isBull], i) => {
        const o = i * CANDLE_WICKS_STRIDE_FLOATS;
        rows[o] = x;
        rows[o + 1] = low;
        rows[o + 2] = high;
        rows[o + 3] = isBull;
    });
    return {
        id: "overlay:candle-wicks",
        kind: "candle-wicks",
        rowCount: bars.length,
        rows,
        bullColor: COLOR,
        bearColor: COLOR,
        wickWidthPx: 1,
    };
}

describe("candle-pack — stride / offset constants", () => {
    it("bodies stride is 6 floats and the bound offsets land on the right columns", () => {
        expect(CANDLE_BODIES_STRIDE_FLOATS).toBe(6);
        expect(CANDLE_BODIES_STRIDE_BYTES).toBe(6 * FLOAT_BYTES);
        // [x(idx), open, high, low, close, isBull] → bound columns 0,1,4,5.
        expect(CANDLE_BODIES_OFFSET_IDX).toBe(0);
        expect(CANDLE_BODIES_OFFSET_OPEN).toBe(1 * FLOAT_BYTES);
        expect(CANDLE_BODIES_OFFSET_CLOSE).toBe(4 * FLOAT_BYTES);
        expect(CANDLE_BODIES_OFFSET_IS_BULL).toBe(5 * FLOAT_BYTES);
    });

    it("wicks stride is 4 floats and the bound offsets land on the right columns", () => {
        expect(CANDLE_WICKS_STRIDE_FLOATS).toBe(4);
        expect(CANDLE_WICKS_STRIDE_BYTES).toBe(4 * FLOAT_BYTES);
        // [x(idx), low, high, isBull].
        expect(CANDLE_WICKS_OFFSET_IDX).toBe(0);
        expect(CANDLE_WICKS_OFFSET_LOW).toBe(1 * FLOAT_BYTES);
        expect(CANDLE_WICKS_OFFSET_HIGH).toBe(2 * FLOAT_BYTES);
        expect(CANDLE_WICKS_OFFSET_IS_BULL).toBe(3 * FLOAT_BYTES);
    });
});

describe("packCandleBodies", () => {
    it("returns the live 6-float-stride window in row order", () => {
        const d = bodies([
            [0, 10, 12, 9, 11],
            [1, 11, 11, 8, 9],
        ]);
        const packed = packCandleBodies(d);
        expect(packed.length).toBe(2 * CANDLE_BODIES_STRIDE_FLOATS);
        expect([...packed]).toEqual([0, 10, 12, 9, 11, 1, 1, 11, 11, 8, 9, 0]);
    });

    it("flags a bull bar (close >= open) as 1 and a bear bar as 0", () => {
        const packed = packCandleBodies(bodies([[0, 10, 12, 9, 11]]));
        expect(packed[CANDLE_BODIES_STRIDE_FLOATS - 1]).toBe(1);
        const bear = packCandleBodies(bodies([[0, 11, 11, 8, 9]]));
        expect(bear[CANDLE_BODIES_STRIDE_FLOATS - 1]).toBe(0);
    });

    it("treats a doji (open === close) as bull (flag 1) — body geometry is max/min(open,close)", () => {
        const d = bodies([[0, 10, 12, 8, 10]]);
        const packed = packCandleBodies(d);
        expect(packed[1]).toBe(packed[4]); // open === close
        expect(packed[CANDLE_BODIES_STRIDE_FLOATS - 1]).toBe(1);
    });

    it("returns a zero-length view for an empty descriptor", () => {
        expect(packCandleBodies(bodies([])).length).toBe(0);
    });

    it("slices only the live rows when `rows` is over-allocated (subarray view, no copy)", () => {
        const d = bodies([[0, 10, 12, 9, 11]]);
        // Over-allocate the backing array but keep rowCount at 1.
        const over = new Float32Array(CANDLE_BODIES_STRIDE_FLOATS * 4);
        over.set(d.rows);
        const padded: CandleBodiesDescriptor = { ...d, rows: over, rowCount: 1 };
        const packed = packCandleBodies(padded);
        expect(packed.length).toBe(CANDLE_BODIES_STRIDE_FLOATS);
        expect(packed.buffer).toBe(over.buffer); // zero-copy view
    });
});

describe("packCandleWicks", () => {
    it("returns the live 4-float-stride window in row order", () => {
        const d = wicks([
            [0, 9, 12, 1],
            [1, 8, 11, 0],
        ]);
        const packed = packCandleWicks(d);
        expect(packed.length).toBe(2 * CANDLE_WICKS_STRIDE_FLOATS);
        expect([...packed]).toEqual([0, 9, 12, 1, 1, 8, 11, 0]);
    });

    it("carries the per-bar isBull flag in the last column", () => {
        const packed = packCandleWicks(wicks([[0, 9, 12, 1]]));
        expect(packed[CANDLE_WICKS_STRIDE_FLOATS - 1]).toBe(1);
        const bear = packCandleWicks(wicks([[0, 8, 11, 0]]));
        expect(bear[CANDLE_WICKS_STRIDE_FLOATS - 1]).toBe(0);
    });

    it("returns a zero-length view for an empty descriptor", () => {
        expect(packCandleWicks(wicks([])).length).toBe(0);
    });

    it("slices only the live rows when `rows` is over-allocated", () => {
        const d = wicks([[0, 9, 12, 1]]);
        const over = new Float32Array(CANDLE_WICKS_STRIDE_FLOATS * 4);
        over.set(d.rows);
        const padded: CandleWicksDescriptor = { ...d, rows: over, rowCount: 1 };
        const packed = packCandleWicks(padded);
        expect(packed.length).toBe(CANDLE_WICKS_STRIDE_FLOATS);
        expect(packed.buffer).toBe(over.buffer);
    });
});
