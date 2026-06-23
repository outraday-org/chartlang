// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Viewport } from "@invinite-org/chartlang-adapter-kit";
import { timeToX } from "@invinite-org/chartlang-adapter-kit";
import type { RenderCtx } from "@invinite-org/chartlang-adapter-kit/canvas";

/**
 * One resolved Pine `bgcolor` band. `time` is the bar the band centres on;
 * `color` is the already-resolved fill (the `colorValue` precedence is
 * settled before this point — a `null` gap is never enqueued); `transp` is
 * the 0–100 transparency (`alpha = 1 - transp/100`).
 *
 * @since 1.7
 * @stable
 * @example
 *     const band: BgColorBand = { time: 0, color: "#26a69a", transp: 85 };
 *     void band;
 */
export type BgColorBand = {
    readonly time: number;
    readonly color: string;
    readonly transp?: number;
};

/**
 * Paint a translucent Pine `bgcolor` band: a full-pane-height vertical
 * strip, ~one bar-slot wide, centred on the band's bar. Mirrors the
 * canvas2d reference adapter's `drawBgColor` semantics — the per-bar
 * `colorValue` precedence (and the `null` gap) is resolved by the caller, so
 * this paints unconditionally at `alpha = 1 - transp/100`. `dx` shifts the
 * band into uPlot's device-px plotting area (the candle/hline offset).
 *
 * @since 1.7
 * @stable
 * @example
 *     import { MockCanvasContext } from "@invinite-org/chartlang-adapter-kit/canvas";
 *     declare const viewport: import("@invinite-org/chartlang-adapter-kit").Viewport;
 *     const ctx = new MockCanvasContext();
 *     drawBgColorBand(ctx, { time: 0, color: "#26a69a", transp: 85 }, viewport, 0, 1);
 *     void ctx.calls.length;
 */
export function drawBgColorBand(
    ctx: RenderCtx,
    band: BgColorBand,
    viewport: Viewport,
    dx: number,
    barCount: number,
): void {
    const width = viewport.pxWidth / Math.max(1, barCount);
    const x = timeToX(band.time, viewport) + dx - width / 2;
    ctx.globalAlpha = 1 - (band.transp ?? 0) / 100;
    ctx.fillStyle = band.color;
    ctx.fillRect(x, 0, width, viewport.pxHeight);
    ctx.globalAlpha = 1;
}
