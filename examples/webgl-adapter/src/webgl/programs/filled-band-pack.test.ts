// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { FilledBandDescriptor } from "../../layer-descriptor.js";
import {
    FILLED_BAND_STRIDE_BYTES,
    FILLED_BAND_STRIDE_FLOATS,
    packFilledBand,
} from "./filled-band-pack.js";

function descriptor(upper: number[], lower: number[], pointCount: number): FilledBandDescriptor {
    return {
        id: "overlay|bb:filled-band",
        kind: "filled-band",
        upper: new Float32Array(upper),
        lower: new Float32Array(lower),
        pointCount,
        color: [0, 0, 0, 0.2],
    };
}

describe("filled-band-pack — stride layout", () => {
    it("declares a 2-float vec2 vertex stride", () => {
        expect(FILLED_BAND_STRIDE_FLOATS).toBe(2);
        expect(FILLED_BAND_STRIDE_BYTES).toBe(8);
    });
});

describe("packFilledBand", () => {
    it("packs aligned edges into one run (upper then lower per column)", () => {
        // 2 columns, each finite: vertices alternate [x, upperY] / [x, lowerY].
        const packed = packFilledBand(descriptor([0, 2, 1, 3], [0, 1, 1, 1.5], 2));
        expect(Array.from(packed.vertices)).toEqual([0, 2, 0, 1, 1, 3, 1, 1.5]);
        expect(packed.runs).toEqual([{ vertexOffset: 0, vertexCount: 4 }]);
    });

    it("clamps to the shorter edge on a length mismatch", () => {
        // upper has 3 columns, lower has 2 → clamp to 2.
        const packed = packFilledBand(descriptor([0, 2, 1, 2, 2, 2], [0, 1, 1, 1], 3));
        expect(packed.vertices.length).toBe(2 * 2 * FILLED_BAND_STRIDE_FLOATS);
        expect(packed.runs).toEqual([{ vertexOffset: 0, vertexCount: 4 }]);
    });

    it("splits a NaN gap into separate runs (no triangle spans the gap)", () => {
        // col 0 finite, col 1 gap (NaN upper), col 2 finite → two runs.
        const packed = packFilledBand(
            descriptor([0, 2, 1, Number.NaN, 2, 2], [0, 1, 1, 1, 2, 1], 3),
        );
        expect(packed.runs).toEqual([
            { vertexOffset: 0, vertexCount: 2 },
            { vertexOffset: 2, vertexCount: 2 },
        ]);
        // The gap column contributes no vertices; only cols 0 and 2 pack.
        expect(Array.from(packed.vertices)).toEqual([0, 2, 0, 1, 2, 2, 2, 1]);
    });

    it("treats a NaN lower (single-null edge) as a per-column gap too", () => {
        const packed = packFilledBand(descriptor([0, 2, 1, 2], [0, 1, 1, Number.NaN], 2));
        expect(packed.runs).toEqual([{ vertexOffset: 0, vertexCount: 2 }]);
    });

    it("yields no runs + a zero-length buffer for an empty descriptor", () => {
        const packed = packFilledBand(descriptor([], [], 0));
        expect(packed.vertices.length).toBe(0);
        expect(packed.runs).toEqual([]);
    });

    it("yields no runs when every column is a gap", () => {
        const packed = packFilledBand(descriptor([0, Number.NaN, 1, Number.NaN], [0, 1, 1, 1], 2));
        expect(packed.vertices.length).toBe(0);
        expect(packed.runs).toEqual([]);
    });
});
