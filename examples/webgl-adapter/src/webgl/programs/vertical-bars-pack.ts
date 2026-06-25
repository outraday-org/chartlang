// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Pure CPU-side geometry packer for the vertical-bars program. The `gl.*`
// upload/draw is browser-only and lives in the `vertical-bars-program.ts`
// sibling; this helper slices the descriptor's `rows` into the exact
// per-instance buffer the VAO binds, so it is node-unit-tested headlessly.

import type { VerticalBarsDescriptor } from "../../layer-descriptor.js";

/** Floats per byte unit — every attribute in the vertical-bars buffer is a 32-bit float. */
export const FLOAT_BYTES = 4;

/**
 * Per-instance stride for the vertical-bars buffer, in floats. Matches the
 * `buildFrame` pack format `[x, height, isPositive]`: the bar's world x
 * center, its signed world-y height above the `y = 0` baseline, and the
 * `1`/`0` sign flag the shader colors on.
 *
 * @since 0.1
 * @stable
 * @example
 *     VERTICAL_BARS_STRIDE_FLOATS === 3;
 */
export const VERTICAL_BARS_STRIDE_FLOATS = 3;

/** Byte stride of one vertical-bars instance row. */
export const VERTICAL_BARS_STRIDE_BYTES = VERTICAL_BARS_STRIDE_FLOATS * FLOAT_BYTES;

/** Byte offset of each bound vertical-bars attribute within its instance row. */
export const VERTICAL_BARS_OFFSET_IDX = 0;
export const VERTICAL_BARS_OFFSET_HEIGHT = FLOAT_BYTES * 1;
export const VERTICAL_BARS_OFFSET_IS_POSITIVE = FLOAT_BYTES * 2;

/**
 * Slice the live `[x, height, isPositive]` instance window out of a
 * {@link VerticalBarsDescriptor}'s `rows` (length `3 * rowCount`). Returns a
 * `subarray` view (zero-copy) so the program uploads only the live rows even
 * when `rows` was over-allocated. An empty descriptor yields a zero-length
 * view. Same contract as the candle-pack helpers.
 *
 * @since 0.1
 * @stable
 * @example
 *     const rows = new Float32Array([0, 1_000, 1]);
 *     const packed = packVerticalBars({
 *         id: "x", kind: "vertical-bars", rows, rowCount: 1,
 *         positiveColor: [0, 0, 0, 1], negativeColor: [0, 0, 0, 1], barWidthPx: 4,
 *     });
 *     packed.length === 3;
 *     void packed;
 */
export function packVerticalBars(descriptor: VerticalBarsDescriptor): Float32Array {
    const liveFloats = descriptor.rowCount * VERTICAL_BARS_STRIDE_FLOATS;
    return descriptor.rows.subarray(0, liveFloats);
}
