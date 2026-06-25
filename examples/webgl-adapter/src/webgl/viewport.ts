// Ported from invinite src/components/trading-chart/webgl/viewport.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling dropped; world window
// comes from the shared ViewController, not invinite's frame-state.

/**
 * Device-pixel rectangle suitable for `gl.viewport(...)` / `gl.scissor(...)`,
 * bottom-left origin. Every component is integer (the single rounding site
 * in {@link paneViewport} produced them).
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const r: DeviceRect;
 *     // gl.viewport(r.xPx, r.yPx, r.widthPx, r.heightPx);
 *     void r.xPx;
 */
export type DeviceRect = {
    readonly xPx: number;
    readonly yPx: number;
    readonly widthPx: number;
    readonly heightPx: number;
};

/**
 * A CSS-pixel pane rectangle, top-left origin (the layout coordinate space
 * the adapter computes pane bounds in). Carries floating-point CSS-px values
 * — {@link paneViewport} is the one place they are rounded to device-px.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const p: PaneCssRect;
 *     void p.width;
 */
export type PaneCssRect = {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
};

/**
 * Convert a CSS-pixel pane rectangle (top-left origin) into a device-pixel
 * rectangle (bottom-left origin) suitable for `gl.viewport` / `gl.scissor`.
 *
 * **Single rounding site.** This is the *only* place that rounds CSS-px →
 * device-px in the WebGL pipeline. Each edge passes through one
 * `Math.round(edge × dpr)`, and width/height come out as the difference of
 * two rounded edges. Adjacent panes therefore share a tile-tight integer
 * seam even at non-integer `dpr` (1.5, 2.25, …): the shared CSS-y boundary
 * is the *same FP value* for both panes, so it rounds identically on each
 * side and pane N's `yPx + heightPx` equals pane N+1's `yPx`.
 *
 * Math (per-edge rounding):
 *
 *     leftPx   = round(pane.x × dpr)
 *     rightPx  = round((pane.x + pane.width) × dpr)
 *     topPx    = round((canvasCssHeight - pane.y) × dpr)
 *     bottomPx = round((canvasCssHeight - pane.y - pane.height) × dpr)
 *     xPx = leftPx,  yPx = bottomPx           // bottom-left origin flip
 *     widthPx = rightPx - leftPx,  heightPx = topPx - bottomPx
 *
 * @since 0.1
 * @stable
 * @example
 *     const r = paneViewport({ x: 50, y: 60, width: 100, height: 80 }, 400, 1);
 *     // r === { xPx: 50, yPx: 260, widthPx: 100, heightPx: 80 }
 *     void r;
 */
export function paneViewport(pane: PaneCssRect, canvasCssHeight: number, dpr: number): DeviceRect {
    const leftPx = Math.round(pane.x * dpr);

    const rightPx = Math.round((pane.x + pane.width) * dpr);

    const topPx = Math.round((canvasCssHeight - pane.y) * dpr);

    const bottomPx = Math.round((canvasCssHeight - pane.y - pane.height) * dpr);

    return {
        heightPx: topPx - bottomPx,
        widthPx: rightPx - leftPx,
        xPx: leftPx,
        yPx: bottomPx,
    };
}
