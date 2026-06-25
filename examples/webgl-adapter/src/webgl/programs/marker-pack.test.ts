// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { MarkerDescriptor, RgbaUnit } from "../../layer-descriptor.js";
import {
    FLOAT_BYTES,
    MARKER_OFFSET_POS,
    MARKER_STRIDE_BYTES,
    MARKER_STRIDE_FLOATS,
    packMarkers,
} from "./marker-pack.js";

const COLOR: RgbaUnit = [1, 0, 0, 1];

// Pack a list of `[x, y]` rows into a marker descriptor.
function markers(rows: ReadonlyArray<readonly [number, number]>): MarkerDescriptor {
    const data = new Float32Array(rows.length * MARKER_STRIDE_FLOATS);
    rows.forEach((row, i) => data.set(row, i * MARKER_STRIDE_FLOATS));
    return {
        color: COLOR,
        id: "overlay:marker",
        kind: "marker",
        radiusPx: 6,
        rowCount: rows.length,
        rows: data,
    };
}

describe("marker-pack — stride / offset constants", () => {
    it("stride is 2 floats and the bound offset lands on pos", () => {
        expect(MARKER_STRIDE_FLOATS).toBe(2);
        expect(MARKER_STRIDE_BYTES).toBe(2 * FLOAT_BYTES);
        expect(MARKER_OFFSET_POS).toBe(0);
    });
});

describe("packMarkers", () => {
    it("returns the live 2-float-stride window in row order", () => {
        const packed = packMarkers(
            markers([
                [10, 20],
                [30, 40],
            ]),
        );
        expect(packed.length).toBe(2 * MARKER_STRIDE_FLOATS);
        expect([...packed]).toEqual([10, 20, 30, 40]);
    });

    it("preserves a NaN y (the GPU clips the projected NaN gl_Position)", () => {
        const packed = packMarkers(markers([[10, Number.NaN]]));
        expect(packed[0]).toBe(10);
        expect(Number.isNaN(packed[1])).toBe(true);
    });

    it("returns a zero-length view for an empty descriptor", () => {
        expect(packMarkers(markers([])).length).toBe(0);
    });

    it("slices only the live rows when `rows` is over-allocated (zero-copy view)", () => {
        const d = markers([[10, 20]]);
        const over = new Float32Array(MARKER_STRIDE_FLOATS * 4);
        over.set(d.rows);
        const padded: MarkerDescriptor = { ...d, rows: over, rowCount: 1 };
        const packed = packMarkers(padded);
        expect(packed.length).toBe(MARKER_STRIDE_FLOATS);
        expect(packed.buffer).toBe(over.buffer);
    });
});
