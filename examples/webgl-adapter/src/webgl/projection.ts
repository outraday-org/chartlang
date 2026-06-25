// Ported from invinite src/components/trading-chart/webgl/projection.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling dropped; world window
// comes from the shared ViewController, not invinite's frame-state.
//
// Divergence from the pinned source: a degenerate span (left === right or
// bottom === top) is clamped to EPSILON before the divide so the matrix
// stays finite — invinite let it produce Infinity/NaN. See CLAUDE.md.

/**
 * Smallest world-span the divide is allowed to see. A degenerate window
 * (equal bounds) would otherwise compute `2 / 0 = Infinity` and poison the
 * matrix; clamping the span to this epsilon keeps every entry finite, the
 * same defensive choice the canvas2d viewport makes for a zero-height
 * price range.
 */
const EPSILON = 1e-9;

/**
 * Build a 3×3 column-major orthographic projection matrix mapping the world
 * rectangle `(left, bottom)`–`(right, top)` onto NDC `(-1, -1)`–`(1, 1)`.
 *
 * The adapter feeds this the world window resolved from the shared
 * `ViewController` (Task 4), NOT invinite's frame-state. The result is a
 * `Float32Array(9)` consumed by a `mat3 uProj` uniform (vec2 input expanded
 * to `vec3(pos.xy, 1.0)`), set via {@link import("./program.js").Program.setUniformMatrix3fv}.
 *
 * Math:
 *
 *     sx = 2 / (right - left)        tx = -(right + left) / (right - left)
 *     sy = 2 / (top - bottom)        ty = -(top + bottom) / (top - bottom)
 *
 *     [ sx,  0, tx ]   stored column-major as
 *     [  0, sy, ty ]   [sx, 0, 0,  0, sy, 0,  tx, ty, 1]
 *     [  0,  0,  1 ]
 *
 * A degenerate span (`left === right` or `bottom === top`) is clamped to
 * {@link EPSILON} so no entry becomes `Infinity`/`NaN`.
 *
 * @since 0.1
 * @stable
 * @example
 *     const m = ortho2d(0, 100, 0, 50);
 *     // m[0] === 2 / 100 (sx), m[4] === 2 / 50 (sy)
 *     void m;
 */
export function ortho2d(left: number, right: number, bottom: number, top: number): Float32Array {
    const spanX = right - left;

    const spanY = top - bottom;

    const safeSpanX = spanX === 0 ? EPSILON : spanX;

    const safeSpanY = spanY === 0 ? EPSILON : spanY;

    const sx = 2 / safeSpanX;

    const sy = 2 / safeSpanY;

    const tx = -(right + left) / safeSpanX;

    const ty = -(top + bottom) / safeSpanY;

    const matrix = new Float32Array(9);

    matrix[0] = sx;

    matrix[1] = 0;

    matrix[2] = 0;

    matrix[3] = 0;

    matrix[4] = sy;

    matrix[5] = 0;

    matrix[6] = tx;

    matrix[7] = ty;

    matrix[8] = 1;

    return matrix;
}
