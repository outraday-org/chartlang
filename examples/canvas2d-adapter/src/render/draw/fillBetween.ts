// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { FillBetweenState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear.js";
import type { Viewport } from "../coords.js";
import { dashPattern } from "../lineDash.js";
import { worldPointToCanvas } from "./worldToCanvas.js";

const DEFAULT_LINE_WIDTH = 1;
const DEFAULT_FILL_ALPHA = 1;

/**
 * Render a `fill-between` drawing emission as a closed filled polygon.
 * The region is `edgeA` walked forward then `edgeB` walked in reverse,
 * exactly how `draw.path` closes a ribbon. `fill` + `fillAlpha` paint
 * the band (alpha bracketed around the `ctx.fill()` call); the outline
 * is stroked only when `style.color` is set. A degenerate edge (`< 1`
 * point) or a non-finite mapped anchor is a silent per-frame no-op,
 * matching every other drawing's warmup behaviour.
 *
 * @since 0.4
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderFillBetween(ctx, e, view);
 *     void renderFillBetween;
 */
export function renderFillBetween(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as FillBetweenState;
    const a = state.edgeA.map((p) => worldPointToCanvas(p, view));
    const b = state.edgeB.map((p) => worldPointToCanvas(p, view));
    if (a.length < 1 || b.length < 1) return; // degenerate → no-op
    if (a.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return;
    if (b.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return;
    const { color, fill } = state.style;
    ctx.setLineDash(dashPattern(state.style.lineStyle ?? "solid"));
    ctx.beginPath();
    ctx.moveTo(a[0].x, a[0].y);
    for (let i = 1; i < a.length; i++) ctx.lineTo(a[i].x, a[i].y);
    for (let i = b.length - 1; i >= 0; i--) ctx.lineTo(b[i].x, b[i].y);
    ctx.closePath();
    if (fill !== undefined) {
        ctx.fillStyle = fill;
        ctx.globalAlpha = state.style.fillAlpha ?? DEFAULT_FILL_ALPHA;
        ctx.fill();
        ctx.globalAlpha = 1;
    }
    if (color !== undefined) {
        ctx.strokeStyle = color;
        ctx.lineWidth = state.style.lineWidth ?? DEFAULT_LINE_WIDTH;
        ctx.stroke();
    }
    ctx.setLineDash([]);
}
