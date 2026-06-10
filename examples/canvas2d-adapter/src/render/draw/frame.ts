// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// State shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (FrameDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// No standalone tool source exists in invinite — the visible
// rectangle + label envelope is a chartlang addition layered on the
// metadata-only collab schema.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { FrameState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear.js";
import type { Viewport } from "../coords.js";
import { worldPointToCanvas } from "./worldToCanvas.js";

const DEFAULT_STROKE = "#64748b";
const DEFAULT_LABEL_COLOR = "#1e293b";
const DEFAULT_LINE_WIDTH = 1;
const LABEL_FONT = "12px sans-serif";
const LABEL_INSET_X = 6;
const LABEL_INSET_Y = 14;

/**
 * Render a `frame` drawing emission as a stroked rectangle between
 * the two world anchors `[topLeft, bottomRight]`. Optional
 * `style.bgColor` paints a background `fillRect` before the stroke;
 * optional `style.label` paints a `fillText` at the top-left corner.
 * Degenerate anchors (zero width or zero height in canvas space) are
 * silently no-op per PLAN.md §7.4.
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderFrame(ctx, e, view);
 *     void renderFrame;
 */
export function renderFrame(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as FrameState;
    const a = worldPointToCanvas(state.anchors[0], view);
    const b = worldPointToCanvas(state.anchors[1], view);
    const xMin = Math.min(a.x, b.x);
    const xMax = Math.max(a.x, b.x);
    const yMin = Math.min(a.y, b.y);
    const yMax = Math.max(a.y, b.y);
    const width = xMax - xMin;
    const height = yMax - yMin;
    if (width === 0 || height === 0) return;
    if (!Number.isFinite(width) || !Number.isFinite(height)) return;
    if (state.style.bgColor !== undefined) {
        ctx.fillStyle = state.style.bgColor;
        ctx.fillRect(xMin, yMin, width, height);
    }
    ctx.strokeStyle = DEFAULT_STROKE;
    ctx.lineWidth = DEFAULT_LINE_WIDTH;
    ctx.beginPath();
    ctx.moveTo(xMin, yMin);
    ctx.lineTo(xMax, yMin);
    ctx.lineTo(xMax, yMax);
    ctx.lineTo(xMin, yMax);
    ctx.closePath();
    ctx.stroke();
    if (state.style.label !== undefined) {
        ctx.fillStyle = DEFAULT_LABEL_COLOR;
        ctx.font = LABEL_FONT;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(state.style.label, xMin + LABEL_INSET_X, yMin + LABEL_INSET_Y);
    }
}
