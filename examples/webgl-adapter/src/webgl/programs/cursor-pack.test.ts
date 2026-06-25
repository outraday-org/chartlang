// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { CursorDescriptor, RgbaUnit } from "../../layer-descriptor.js";
import {
    CURSOR_OFFSET_COLOR,
    CURSOR_OFFSET_POS,
    CURSOR_STRIDE_BYTES,
    CURSOR_STRIDE_FLOATS,
    FLOAT_BYTES,
    packCursors,
} from "./cursor-pack.js";

// Exact-binary-fraction color components so the Float32 round-trip is lossless
// (the candle-pack tests use the same exact-value idiom).
const COLOR: RgbaUnit = [0.5, 0.25, 0.75, 1];

// Pack a list of `[x, y, r, g, b, a]` rows into a cursor descriptor.
function cursors(
    rows: ReadonlyArray<readonly [number, number, number, number, number, number]>,
): CursorDescriptor {
    const data = new Float32Array(rows.length * CURSOR_STRIDE_FLOATS);
    rows.forEach((row, i) => data.set(row, i * CURSOR_STRIDE_FLOATS));
    return {
        id: "overlay:cursor",
        kind: "cursor",
        radiusPx: 3,
        rowCount: rows.length,
        rows: data,
    };
}

describe("cursor-pack — stride / offset constants", () => {
    it("stride is 6 floats and the bound offsets land on pos / color", () => {
        expect(CURSOR_STRIDE_FLOATS).toBe(6);
        expect(CURSOR_STRIDE_BYTES).toBe(6 * FLOAT_BYTES);
        expect(CURSOR_OFFSET_POS).toBe(0);
        expect(CURSOR_OFFSET_COLOR).toBe(2 * FLOAT_BYTES);
    });
});

describe("packCursors", () => {
    it("returns the live 6-float-stride window in row order", () => {
        const packed = packCursors(
            cursors([
                [10, 20, 0.5, 0.25, 0.75, 1],
                [30, 40, 0.25, 0.5, 0.125, 0.5],
            ]),
        );
        expect(packed.length).toBe(2 * CURSOR_STRIDE_FLOATS);
        expect([...packed]).toEqual([10, 20, 0.5, 0.25, 0.75, 1, 30, 40, 0.25, 0.5, 0.125, 0.5]);
    });

    it("returns a zero-length view for an empty descriptor", () => {
        expect(packCursors(cursors([])).length).toBe(0);
    });

    it("slices only the live rows when `rows` is over-allocated (zero-copy view)", () => {
        const d = cursors([[10, 20, ...COLOR]]);
        const over = new Float32Array(CURSOR_STRIDE_FLOATS * 4);
        over.set(d.rows);
        const padded: CursorDescriptor = { ...d, rows: over, rowCount: 1 };
        const packed = packCursors(padded);
        expect(packed.length).toBe(CURSOR_STRIDE_FLOATS);
        expect(packed.buffer).toBe(over.buffer);
    });
});
