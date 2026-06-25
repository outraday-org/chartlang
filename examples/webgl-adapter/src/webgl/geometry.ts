// Ported from invinite src/components/trading-chart/webgl/geometry.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling dropped; world window
// comes from the shared ViewController, not invinite's frame-state.

/**
 * Unit-quad in the `[-1..+1]` corner range, in triangle-strip vertex
 * order: bottom-left, bottom-right, top-left, top-right. Shared by the
 * candle-body / candle-wick / cursor programs (later tasks) — each binds
 * the buffer once at construction and expands the quad in NDC via
 * per-instance attributes.
 *
 * Treated as static GPU data (uploaded once with `gl.STATIC_DRAW`); never
 * mutate this array. (TypedArray views are not freezable in V8 —
 * `Object.freeze` on a `Float32Array` throws synchronously, so the
 * read-only contract is by convention, asserted at the comment level.)
 *
 * @since 0.1
 * @stable
 * @example
 *     UNIT_QUAD_TRIANGLE_STRIP.length === 8;
 *     void UNIT_QUAD_TRIANGLE_STRIP;
 */
export const UNIT_QUAD_TRIANGLE_STRIP: Float32Array = new Float32Array([
    -1, -1, 1, -1, -1, 1, 1, 1,
]);

/**
 * Y-from-zero quad in the `[-1..+1]` x range and `[0..+1]` y range, used
 * by the vertical-bars program (volume bars + MACD histogram, later
 * tasks). Bars anchor at `y = 0` so a per-instance height attribute can
 * extend the bar upward (positive) or downward (negative). Triangle-strip
 * vertex order: bottom-left, bottom-right, top-left, top-right.
 *
 * Same static-data treatment as {@link UNIT_QUAD_TRIANGLE_STRIP}.
 *
 * @since 0.1
 * @stable
 * @example
 *     Y_ZERO_QUAD_TRIANGLE_STRIP.length === 8;
 *     void Y_ZERO_QUAD_TRIANGLE_STRIP;
 */
export const Y_ZERO_QUAD_TRIANGLE_STRIP: Float32Array = new Float32Array([
    -1, 0, 1, 0, -1, 1, 1, 1,
]);
