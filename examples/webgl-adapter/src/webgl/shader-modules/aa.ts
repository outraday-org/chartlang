// Ported from invinite src/components/trading-chart/webgl/shader-modules/aa.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling dropped; world window
// comes from the shared ViewController, not invinite's frame-state.
//
// Pattern inspired by luma.gl's vs-utils + deck.gl's IconLayer fragment
// shader (MIT, Uber / vis.gl), re-implemented in-tree — NOT an npm
// dependency on luma.gl / deck.gl.

/**
 * Fragment-shader fragment exporting one helper consumed by the cursors
 * program (Task 12) and any future program needing a smooth-edged
 * primitive (drawing-tool caps, hover halos, indicator markers):
 *
 * - `disk_aa_alpha(localNorm)` returns the premultiplied edge-AA alpha for
 *   a unit-quad disk. `localNorm` is the per-vertex `aCorner` interpolated
 *   into the fragment shader (range `-1..1` on both axes; `0` at the disk
 *   center). Returns 1 inside the unit disk, 0 outside, and a 1-pixel-wide
 *   soft edge from `fwidth(r)`. Cheap enough to call once per fragment.
 *
 * @since 0.1
 * @stable
 * @example
 *     AA_FS_GLSL.includes("disk_aa_alpha") === true;
 *     void AA_FS_GLSL;
 */
export const AA_FS_GLSL = `
float disk_aa_alpha(vec2 localNorm) {
    float r = length(localNorm);
    float aa = fwidth(r);
    return 1.0 - smoothstep(1.0 - aa, 1.0, r);
}
`;
