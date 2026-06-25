// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Pure CPU-side geometry packer for the filled-band program. The `gl.*`
// upload/draw is browser-only and lives in the `filled-band-program.ts`
// sibling; this helper walks the descriptor's two world-space edge polylines
// into a NaN-gap-split triangle-strip vertex buffer, so it is node-unit-tested
// headlessly.

import type { FilledBandDescriptor } from "../../layer-descriptor.js";

/** Floats per byte unit — every value in the filled-band buffer is a 32-bit float. */
export const FLOAT_BYTES = 4;

/**
 * Floats per triangle-strip vertex: `[x, y]` in **world** space (the band
 * carries a single uniform color, so no per-vertex color is packed — diverging
 * from invinite's 6-float `[barIndex, price, r, g, b, a]` vertex).
 *
 * @since 0.1
 * @stable
 * @example
 *     FILLED_BAND_STRIDE_FLOATS === 2;
 */
export const FILLED_BAND_STRIDE_FLOATS = 2;

/** Byte stride of one filled-band vertex. */
export const FILLED_BAND_STRIDE_BYTES = FILLED_BAND_STRIDE_FLOATS * FLOAT_BYTES;

/**
 * A contiguous run of finite `(upper, lower)` columns — one
 * `gl.drawArrays(TRIANGLE_STRIP, vertexOffset, vertexCount)` call. NaN gaps
 * (a non-finite upper OR lower) split the strip into separate runs so the GPU
 * never spans a triangle across a per-column gap.
 *
 * @since 0.1
 * @stable
 * @example
 *     const r: Run = { vertexOffset: 0, vertexCount: 4 };
 *     void r;
 */
export type Run = {
    readonly vertexOffset: number;
    readonly vertexCount: number;
};

/**
 * Result of {@link packFilledBand}: the interleaved triangle-strip vertex
 * buffer (stride {@link FILLED_BAND_STRIDE_FLOATS}) + the NaN-separated runs.
 * `vertices` is right-sized to the live vertex count (`2 * finiteColumns *
 * stride`); an empty / all-gap descriptor yields a zero-length buffer + no
 * runs (the program no-ops).
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const r: FilledBandPackResult;
 *     // r.vertices.length === r.runs.reduce((n, run) => n + run.vertexCount, 0) * 2
 *     void r;
 */
export type FilledBandPackResult = {
    readonly vertices: Float32Array;
    readonly runs: ReadonlyArray<Run>;
};

/**
 * Build the triangle-strip vertex buffer for a {@link FilledBandDescriptor}.
 * Walks the `upper` / `lower` world-space edge polylines column-by-column
 * (each packed `[x0, y0, x1, y1, …]`), and for every column where BOTH edges
 * are finite appends two vertices — upper then lower — the TRIANGLE_STRIP
 * convention that fills the quad between adjacent columns. A non-finite upper
 * OR lower y closes the current run (no spanning triangle across the gap); the
 * next finite column opens a fresh run. The upper / lower x is read from the
 * `upper` edge (the two edges share an x axis).
 *
 * Mismatched edge lengths clamp to the SHORTER (`min(upper, lower, pointCount)`
 * columns); an empty descriptor or one whose every column has a gap yields a
 * zero-length buffer + no runs.
 *
 * @since 0.1
 * @stable
 * @example
 *     const packed = packFilledBand({
 *         id: "x", kind: "filled-band",
 *         upper: new Float32Array([0, 2, 1, 2]),
 *         lower: new Float32Array([0, 1, 1, 1]),
 *         pointCount: 2, color: [0, 0, 0, 0.2],
 *     });
 *     // packed.vertices.length === 8 (2 columns × 2 verts × 2 floats)
 *     void packed;
 */
export function packFilledBand(descriptor: FilledBandDescriptor): FilledBandPackResult {
    const { upper, lower } = descriptor;
    // Clamp to the shorter edge (and the declared pointCount) so a mismatched
    // pair never reads past the shorter buffer.
    const colCount = Math.min(
        descriptor.pointCount,
        Math.floor(upper.length / 2),
        Math.floor(lower.length / 2),
    );
    if (colCount === 0) return { vertices: new Float32Array(0), runs: [] };

    // Worst case: every column finite ⇒ 2 verts/column. Pack into a max-sized
    // scratch then right-size the returned view to the live vertex count.
    const scratch = new Float32Array(colCount * 2 * FILLED_BAND_STRIDE_FLOATS);
    const runs: Run[] = [];

    let vertexCursor = 0;
    let runStartVertex = -1;

    for (let i = 0; i < colCount; i += 1) {
        const x = upper[i * 2];
        const upperY = upper[i * 2 + 1];
        const lowerY = lower[i * 2 + 1];
        const valid = Number.isFinite(upperY) && Number.isFinite(lowerY);

        if (!valid) {
            // Close the in-progress run at the gap; the next finite column
            // opens a fresh run (no triangle spans the gap).
            if (runStartVertex !== -1) {
                runs.push({
                    vertexOffset: runStartVertex,
                    vertexCount: vertexCursor - runStartVertex,
                });
                runStartVertex = -1;
            }
            continue;
        }

        if (runStartVertex === -1) runStartVertex = vertexCursor;

        const upperBase = vertexCursor * FILLED_BAND_STRIDE_FLOATS;
        scratch[upperBase] = x;
        scratch[upperBase + 1] = upperY;
        const lowerBase = (vertexCursor + 1) * FILLED_BAND_STRIDE_FLOATS;
        scratch[lowerBase] = x;
        scratch[lowerBase + 1] = lowerY;
        vertexCursor += 2;
    }

    if (runStartVertex !== -1) {
        runs.push({
            vertexOffset: runStartVertex,
            vertexCount: vertexCursor - runStartVertex,
        });
    }

    const liveFloats = vertexCursor * FILLED_BAND_STRIDE_FLOATS;
    return { vertices: scratch.subarray(0, liveFloats), runs };
}
