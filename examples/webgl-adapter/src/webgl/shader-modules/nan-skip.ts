// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Ported from invinite src/components/trading-chart/webgl/shader-modules/nan-skip.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling dropped; world window
// comes from the shared ViewController, not invinite's frame-state.
//
// Pattern inspired by luma.gl's project module (MIT, Uber / vis.gl),
// re-implemented in-tree — NOT an npm dependency on luma.gl.

/**
 * Vertex-shader fragment exporting two predicates consumed by the
 * line-strip program (Task 7) to collapse degenerate polyline segments:
 *
 * - `nan_skip_segmentInvalid(a, b)` returns true when either endpoint of a
 *   segment carries a NaN component — the caller maps the instance to
 *   `gl_Position = vec4(0.0)` so the GPU clips it.
 * - `nan_skip_neighborInvalid(neighborPos, neighborRef)` returns true when
 *   the neighbor sample is NaN OR collapses onto the reference point (no
 *   neighbor direction). The caller falls back to the segment normal
 *   instead of computing a miter join.
 *
 * The vertical-bars program deliberately does NOT consume this module: NaN
 * heights propagate through `uProj * vec3(worldPos, 1.0)` to a NaN
 * `gl_Position` the GPU clips — no CPU filter, no shader branch.
 *
 * @since 0.1
 * @stable
 * @example
 *     NAN_SKIP_VS_GLSL.includes("nan_skip_segmentInvalid") === true;
 *     void NAN_SKIP_VS_GLSL;
 */
export const NAN_SKIP_VS_GLSL = `
bool nan_skip_segmentInvalid(vec2 a, vec2 b) {
    return any(isnan(a)) || any(isnan(b));
}

bool nan_skip_neighborInvalid(vec2 neighborPos, vec2 neighborRef) {
    return any(isnan(neighborPos)) || (neighborPos == neighborRef);
}
`;
