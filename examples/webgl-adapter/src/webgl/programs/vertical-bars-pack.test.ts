// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { VerticalBarsDescriptor } from "../../layer-descriptor.js";
import {
    VERTICAL_BARS_OFFSET_HEIGHT,
    VERTICAL_BARS_OFFSET_IDX,
    VERTICAL_BARS_OFFSET_IS_POSITIVE,
    VERTICAL_BARS_STRIDE_BYTES,
    VERTICAL_BARS_STRIDE_FLOATS,
    packVerticalBars,
} from "./vertical-bars-pack.js";

function descriptor(rows: number[], rowCount: number): VerticalBarsDescriptor {
    return {
        id: "overlay|vol:vertical-bars",
        kind: "vertical-bars",
        rows: new Float32Array(rows),
        rowCount,
        positiveColor: [0, 1, 0, 1],
        negativeColor: [1, 0, 0, 1],
        barWidthPx: 4,
    };
}

describe("vertical-bars-pack — stride layout", () => {
    it("declares a 3-float instance stride with idx/height/isPositive offsets", () => {
        expect(VERTICAL_BARS_STRIDE_FLOATS).toBe(3);
        expect(VERTICAL_BARS_STRIDE_BYTES).toBe(12);
        expect(VERTICAL_BARS_OFFSET_IDX).toBe(0);
        expect(VERTICAL_BARS_OFFSET_HEIGHT).toBe(4);
        expect(VERTICAL_BARS_OFFSET_IS_POSITIVE).toBe(8);
    });
});

describe("packVerticalBars", () => {
    it("returns the live [x, height, isPositive] window", () => {
        const packed = packVerticalBars(descriptor([0, 1000, 1, 10, 500, 1], 2));
        expect(Array.from(packed)).toEqual([0, 1000, 1, 10, 500, 1]);
    });

    it("slices off over-allocated trailing rows (zero-copy subarray)", () => {
        // rows holds 3 rows of capacity but only 1 live.
        const d = descriptor([0, 1000, 1, 0, 0, 0, 0, 0, 0], 1);
        const packed = packVerticalBars(d);
        expect(packed.length).toBe(3);
        expect(packed.buffer).toBe(d.rows.buffer);
    });

    it("yields a zero-length view for an empty descriptor", () => {
        expect(packVerticalBars(descriptor([], 0)).length).toBe(0);
    });

    it("preserves a NaN height (the GPU clips it; no CPU filter)", () => {
        const packed = packVerticalBars(descriptor([0, Number.NaN, 0], 1));
        expect(Number.isNaN(packed[1])).toBe(true);
    });
});
