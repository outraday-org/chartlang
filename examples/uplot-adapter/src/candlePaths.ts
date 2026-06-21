// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// The body+wick geometry below is the reference math from uPlot's
// official candlestick-paths demo
// (github.com/leeoniya/uPlot/blob/master/demos/candlestick-ohlc.html):
// per bar, a vertical wick line from high→low and a filled body rect
// from open→close, tinted bull/bear by close-vs-open. Translated to a
// renderer-agnostic `RenderCtx` sink (no DOM, no uPlot internals) so it
// stays pure and 100%-testable; the path shape is the contract, the
// demo's plugin/canvas boilerplate is not.

import type { RenderCtx } from "@invinite-org/chartlang-adapter-kit/canvas";

/**
 * One candle already projected into pixel space. `x` is the bar centre;
 * `openY` / `closeY` / `highY` / `lowY` are pixel y for the four prices
 * (canvas y grows downward, so a higher price is a smaller y).
 *
 * @since 1.4
 * @stable
 * @example
 *     const c: ProjectedCandle = { x: 50, openY: 80, closeY: 40, highY: 20, lowY: 100 };
 *     void c;
 */
export type ProjectedCandle = {
    readonly x: number;
    readonly openY: number;
    readonly closeY: number;
    readonly highY: number;
    readonly lowY: number;
};

/**
 * Colour + geometry knobs for {@link drawCandlePaths}. `bodyWidth` is the
 * candle body width in pixels; `bull` / `bear` tint the body (and wick)
 * by close-vs-open; `doji` (open === close) falls back to `bull`.
 *
 * @since 1.4
 * @stable
 * @example
 *     const s: CandlePathStyle = { bodyWidth: 6, bull: "#26a69a", bear: "#ef5350" };
 *     void s;
 */
export type CandlePathStyle = {
    readonly bodyWidth: number;
    readonly bull: string;
    readonly bear: string;
};

// A degenerate body (open === close on a doji) still paints a 1px rect so
// the bar is visible — the demo draws the thin line the same way.
const MIN_BODY_HEIGHT_PX = 1;

/**
 * Paint a candlestick series to a {@link RenderCtx}, one wick line + one
 * body rect per candle, bull/bear-tinted by close-vs-open. Non-finite
 * geometry (a `null`/NaN bar that projected to `NaN`) is a per-candle
 * skip — no spurious wick or body — so a gappy series leaves a gap. The
 * call sequence is canonical so adapters can pin a `hashCallLog`.
 *
 * @since 1.4
 * @stable
 * @example
 *     import { MockCanvasContext } from "@invinite-org/chartlang-adapter-kit/canvas";
 *     const ctx = new MockCanvasContext();
 *     drawCandlePaths(
 *         ctx,
 *         [{ x: 50, openY: 80, closeY: 40, highY: 20, lowY: 100 }],
 *         { bodyWidth: 6, bull: "#26a69a", bear: "#ef5350" },
 *     );
 *     void ctx.calls.length;
 */
export function drawCandlePaths(
    ctx: RenderCtx,
    candles: ReadonlyArray<ProjectedCandle>,
    style: CandlePathStyle,
): void {
    const halfBody = style.bodyWidth / 2;
    for (const candle of candles) {
        if (
            !Number.isFinite(candle.x) ||
            !Number.isFinite(candle.openY) ||
            !Number.isFinite(candle.closeY) ||
            !Number.isFinite(candle.highY) ||
            !Number.isFinite(candle.lowY)
        ) {
            continue;
        }
        // Smaller y is a higher price, so a bull candle (close above
        // open) has `closeY < openY`. A doji (equal) tints bull.
        const isBull = candle.closeY <= candle.openY;
        const color = isBull ? style.bull : style.bear;
        // Wick: a single vertical line high → low at the bar centre.
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(candle.x, candle.highY);
        ctx.lineTo(candle.x, candle.lowY);
        ctx.stroke();
        // Body: a filled rect spanning open → close, clamped to a
        // visible minimum height for a doji.
        const top = Math.min(candle.openY, candle.closeY);
        const rawHeight = Math.abs(candle.closeY - candle.openY);
        const height = Math.max(MIN_BODY_HEIGHT_PX, rawHeight);
        ctx.fillStyle = color;
        ctx.fillRect(candle.x - halfBody, top, style.bodyWidth, height);
    }
}
