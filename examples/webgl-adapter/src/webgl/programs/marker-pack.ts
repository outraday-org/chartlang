// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Pure CPU-side geometry packer shared by the markers + indicator-markers
// programs. The `gl.*` upload/draw is browser-only and lives in the
// `*-program.ts` siblings; this helper slices the descriptor's `[x, y]` `rows`
// into the exact per-instance buffer the VAO binds, so it is node-unit-tested
// headlessly.

import type { MarkerDescriptor } from "../../layer-descriptor.js";

/** Floats per byte unit — every attribute in the marker buffers is a 32-bit float. */
export const FLOAT_BYTES = 4;

/**
 * Per-instance stride for the marker buffers, in floats. Matches the
 * descriptor pack format `[x, y]` (world position only; color / radius /
 * orientation are descriptor-uniform, set as program uniforms).
 *
 * @since 0.1
 * @stable
 * @example
 *     MARKER_STRIDE_FLOATS === 2;
 */
export const MARKER_STRIDE_FLOATS = 2;

/** Byte stride of one marker instance row. */
export const MARKER_STRIDE_BYTES = MARKER_STRIDE_FLOATS * FLOAT_BYTES;

/** Byte offset of the bound `aPos` attribute within its instance row. */
export const MARKER_OFFSET_POS = 0;

/**
 * Slice the live `[x, y]` instance window out of a {@link MarkerDescriptor}'s
 * `rows` (length `2 * rowCount`). Returns a `subarray` view (zero-copy) so the
 * program uploads only the live rows even when `rows` was over-allocated. An
 * empty descriptor yields a zero-length view. A non-finite y propagates through
 * the projection to a NaN `gl_Position` the GPU clips — no CPU-side filter.
 *
 * @since 0.1
 * @stable
 * @example
 *     const rows = new Float32Array([10, 20]);
 *     const packed = packMarkers({
 *         id: "overlay:marker", kind: "marker", rows, rowCount: 1,
 *         color: [1, 0, 0, 1], radiusPx: 6,
 *     });
 *     packed.length === 2;
 *     void packed;
 */
export function packMarkers(descriptor: MarkerDescriptor): Float32Array {
    const liveFloats = descriptor.rowCount * MARKER_STRIDE_FLOATS;
    return descriptor.rows.subarray(0, liveFloats);
}
