// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Pure CPU-side geometry packer for the cursors program. The `gl.*`
// upload/draw is browser-only and lives in `cursors-program.ts`; this helper
// slices the descriptor's `rows` into the exact per-instance buffer the VAO
// binds, so it is node-unit-tested headlessly.

import type { CursorDescriptor } from "../../layer-descriptor.js";

/** Floats per byte unit — every attribute in the cursor buffer is a 32-bit float. */
export const FLOAT_BYTES = 4;

/**
 * Per-instance stride for the cursor buffer, in floats. Matches the
 * descriptor pack format `[x, y, r, g, b, a]` (world position + unit RGBA).
 *
 * @since 0.1
 * @stable
 * @example
 *     CURSOR_STRIDE_FLOATS === 6;
 */
export const CURSOR_STRIDE_FLOATS = 6;

/** Byte stride of one cursor instance row. */
export const CURSOR_STRIDE_BYTES = CURSOR_STRIDE_FLOATS * FLOAT_BYTES;

/** Byte offset of each bound cursor attribute within its instance row. */
export const CURSOR_OFFSET_POS = 0;
export const CURSOR_OFFSET_COLOR = FLOAT_BYTES * 2;

/**
 * Slice the live `[x, y, r, g, b, a]` instance window out of a
 * {@link CursorDescriptor}'s `rows` (length `6 * rowCount`). Returns a
 * `subarray` view (zero-copy) so the program uploads only the live rows even
 * when `rows` was over-allocated. An empty descriptor yields a zero-length
 * view.
 *
 * @since 0.1
 * @stable
 * @example
 *     const rows = new Float32Array([10, 20, 1, 1, 1, 1]);
 *     const packed = packCursors({
 *         id: "overlay:cursor", kind: "cursor", rows, rowCount: 1, radiusPx: 3,
 *     });
 *     packed.length === 6;
 *     void packed;
 */
export function packCursors(descriptor: CursorDescriptor): Float32Array {
    const liveFloats = descriptor.rowCount * CURSOR_STRIDE_FLOATS;
    return descriptor.rows.subarray(0, liveFloats);
}
