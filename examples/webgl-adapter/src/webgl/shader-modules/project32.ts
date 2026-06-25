// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Ported from invinite src/components/trading-chart/webgl/shader-modules/project32.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling dropped; world window
// comes from the shared ViewController, not invinite's frame-state.
//
// Pattern inspired by luma.gl's project module (MIT, Uber / vis.gl),
// re-implemented in-tree — NOT an npm dependency on luma.gl.

/**
 * Uniforms declared by {@link PROJECT32_VS_GLSL}. Programs that consume the
 * module spread this tuple into their attribute/uniform name list so
 * {@link import("../program.js").Program} resolves + caches the matching
 * `WebGLUniformLocation`.
 *
 * @since 0.1
 * @stable
 * @example
 *     PROJECT32_UNIFORMS.includes("uViewportSize") === true;
 *     void PROJECT32_UNIFORMS;
 */
export const PROJECT32_UNIFORMS = ["uViewportSize", "uDpr"] as const;

/**
 * Vertex-shader fragment exporting two helpers consumed by the bar programs
 * (candle bodies / candle wicks / vertical bars):
 *
 * - `worldToSnappedNdc(worldPos, uProj)` projects a world-space position to
 *   NDC, converts to device-px via `uViewportSize`, floors + 0.5 for
 *   pixel-center snap, and converts back to NDC — so bar / wick edges land
 *   on integer device-px boundaries and rasterize without AA leak.
 * - `dojiInflateNdcY()` returns the NDC-y span of one device pixel, used by
 *   the candle-bodies shader to enforce a 1-device-px minimum body height
 *   when `open == close`.
 *
 * @since 0.1
 * @stable
 * @example
 *     PROJECT32_VS_GLSL.includes("worldToSnappedNdc") === true;
 *     void PROJECT32_VS_GLSL;
 */
export const PROJECT32_VS_GLSL = `
uniform vec2 uViewportSize;
uniform float uDpr;

vec2 worldToSnappedNdc(vec2 worldPos, mat3 uProj) {
    vec2 ndc = (uProj * vec3(worldPos, 1.0)).xy;
    vec2 devicePxCenter = (ndc * 0.5 + 0.5) * uViewportSize;
    vec2 snapped = floor(devicePxCenter) + 0.5;
    return (snapped / uViewportSize) * 2.0 - 1.0;
}

float dojiInflateNdcY() {
    return 1.0 / (uViewportSize.y * 0.5);
}
`;
