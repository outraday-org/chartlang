// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Pure CPU-side geometry packers for the candle programs. The `gl.*`
// upload/draw is browser-only and lives in the *-program.ts siblings; these
// helpers slice the descriptor's `rows` into the exact per-instance buffer
// the VAO binds, so they are node-unit-tested headlessly.

import type { CandleBodiesDescriptor, CandleWicksDescriptor } from "../../layer-descriptor.js";

/** Floats per byte unit — every attribute in the candle buffers is a 32-bit float. */
export const FLOAT_BYTES = 4;

/**
 * Per-instance stride for the candle-bodies buffer, in floats. Matches the
 * `buildFrame` pack format `[x, open, high, low, close, isBull]` (the shader
 * binds `x`/`open`/`close`/`isBull`; `high`/`low` are present but unbound —
 * the body geometry is `max/min(open, close)`).
 *
 * @since 0.1
 * @stable
 * @example
 *     CANDLE_BODIES_STRIDE_FLOATS === 6;
 */
export const CANDLE_BODIES_STRIDE_FLOATS = 6;

/** Byte stride of one candle-bodies instance row. */
export const CANDLE_BODIES_STRIDE_BYTES = CANDLE_BODIES_STRIDE_FLOATS * FLOAT_BYTES;

/** Byte offset of each bound bodies attribute within its instance row. */
export const CANDLE_BODIES_OFFSET_IDX = 0;
export const CANDLE_BODIES_OFFSET_OPEN = FLOAT_BYTES * 1;
export const CANDLE_BODIES_OFFSET_CLOSE = FLOAT_BYTES * 4;
export const CANDLE_BODIES_OFFSET_IS_BULL = FLOAT_BYTES * 5;

/**
 * Per-instance stride for the candle-wicks buffer, in floats. Matches the
 * `buildFrame` pack format `[x, low, high, isBull]`.
 *
 * @since 0.1
 * @stable
 * @example
 *     CANDLE_WICKS_STRIDE_FLOATS === 4;
 */
export const CANDLE_WICKS_STRIDE_FLOATS = 4;

/** Byte stride of one candle-wicks instance row. */
export const CANDLE_WICKS_STRIDE_BYTES = CANDLE_WICKS_STRIDE_FLOATS * FLOAT_BYTES;

/** Byte offset of each bound wicks attribute within its instance row. */
export const CANDLE_WICKS_OFFSET_IDX = 0;
export const CANDLE_WICKS_OFFSET_LOW = FLOAT_BYTES * 1;
export const CANDLE_WICKS_OFFSET_HIGH = FLOAT_BYTES * 2;
export const CANDLE_WICKS_OFFSET_IS_BULL = FLOAT_BYTES * 3;

/**
 * Slice the live `[x, open, high, low, close, isBull]` instance window out of
 * a {@link CandleBodiesDescriptor}'s `rows` (length `6 * rowCount`). Returns
 * a `subarray` view (zero-copy) so the program uploads only the live rows
 * even when `rows` was over-allocated. An empty descriptor yields a
 * zero-length view.
 *
 * @since 0.1
 * @stable
 * @example
 *     const rows = new Float32Array([0, 1, 2, 0, 1.5, 1]);
 *     const packed = packCandleBodies({
 *         id: "x", kind: "candle-bodies", rows, rowCount: 1,
 *         bullColor: [0, 0, 0, 1], bearColor: [0, 0, 0, 1], bodyWidthPx: 6,
 *     });
 *     packed.length === 6;
 *     void packed;
 */
export function packCandleBodies(descriptor: CandleBodiesDescriptor): Float32Array {
    const liveFloats = descriptor.rowCount * CANDLE_BODIES_STRIDE_FLOATS;
    return descriptor.rows.subarray(0, liveFloats);
}

/**
 * Slice the live `[x, low, high, isBull]` instance window out of a
 * {@link CandleWicksDescriptor}'s `rows` (length `4 * rowCount`). Same
 * zero-copy `subarray` contract as {@link packCandleBodies}.
 *
 * @since 0.1
 * @stable
 * @example
 *     const rows = new Float32Array([0, 0.5, 2.5, 1]);
 *     const packed = packCandleWicks({
 *         id: "x", kind: "candle-wicks", rows, rowCount: 1,
 *         wickColor: [0, 0, 0, 1], wickWidthPx: 1,
 *     });
 *     packed.length === 4;
 *     void packed;
 */
export function packCandleWicks(descriptor: CandleWicksDescriptor): Float32Array {
    const liveFloats = descriptor.rowCount * CANDLE_WICKS_STRIDE_FLOATS;
    return descriptor.rows.subarray(0, liveFloats);
}
