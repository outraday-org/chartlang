// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Sampled sinusoid geometry ported from
//   invinite/src/components/trading-chart/tools/sine-line-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { SineLineState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear";
import type { Viewport } from "../coords";
import { dashPattern } from "../lineDash";
import { worldPointToCanvas } from "./worldToCanvas";

const DEFAULT_COLOR = "#0ea5e9";
const DEFAULT_LINE_WIDTH = 1;
const SAMPLES_PER_PERIOD = 32;
const VIEWPORT_PAD_PX = 16;

/**
 * Render a `sine-line` drawing emission as a sampled sinusoidal
 * polyline. The half-period is `|toX - fromX|` (full period doubled);
 * baseline is the midpoint of `(fromY, toY)`; amplitude is half the
 * y-distance between anchors. Samples 32 points per full period across
 * the visible viewport. Skips silently if the half-period is
 * non-positive.
 *
 * @since 0.3
 * @experimental
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderSineLine(ctx, e, view);
 *     void renderSineLine;
 */
export function renderSineLine(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as SineLineState;
    const [from, to] = state.anchors;
    const fromPx = worldPointToCanvas(from, view);
    const toPx = worldPointToCanvas(to, view);
    const halfPeriodPx = Math.abs(toPx.x - fromPx.x);
    if (!Number.isFinite(halfPeriodPx) || halfPeriodPx <= 0) return;
    const fullPeriodPx = 2 * halfPeriodPx;
    const baselineY = (fromPx.y + toPx.y) / 2;
    const amplitudePx = Math.abs(fromPx.y - toPx.y) / 2;
    // Sign convention mirrors invinite's `extremeIsPeak`: if `from` is
    // priced ABOVE `to`, fromPx.y is SMALLER (canvas y flipped) so the
    // wave starts at the upper peak; otherwise it starts at the lower
    // trough. The phase term shifts the wave so `t = fromPx.x` lands on
    // the extreme.
    const peakAtFrom = fromPx.y < toPx.y ? 1 : -1;
    const sampleY = (x: number): number => {
        const phase = (2 * Math.PI * (x - fromPx.x)) / fullPeriodPx;
        return baselineY - peakAtFrom * amplitudePx * Math.cos(phase);
    };
    const xMin = -VIEWPORT_PAD_PX;
    const xMax = view.pxWidth + VIEWPORT_PAD_PX;
    const stepPx = fullPeriodPx / SAMPLES_PER_PERIOD;
    const sampleCount = Math.max(2, Math.ceil((xMax - xMin) / stepPx) + 1);
    ctx.strokeStyle = state.style.color ?? DEFAULT_COLOR;
    ctx.lineWidth = state.style.lineWidth ?? DEFAULT_LINE_WIDTH;
    ctx.setLineDash(dashPattern(state.style.lineStyle ?? "solid"));
    ctx.beginPath();
    ctx.moveTo(xMin, sampleY(xMin));
    for (let i = 1; i < sampleCount; i++) {
        const x = xMin + i * stepPx;
        ctx.lineTo(x, sampleY(x));
    }
    ctx.stroke();
    ctx.setLineDash([]);
}
