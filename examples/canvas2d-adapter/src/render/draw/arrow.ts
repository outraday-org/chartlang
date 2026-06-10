// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Shaft + arrowhead semantics ported from
//   invinite/src/components/trading-chart/tools/arrow-tool.ts,
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (ArrowDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { ArrowState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear";
import type { Viewport } from "../coords";
import { dashPattern } from "../lineDash";
import { drawArrowhead } from "./arrowhead";
import { worldPointToCanvas } from "./worldToCanvas";

const DEFAULT_COLOR = "#000000";
const DEFAULT_LINE_WIDTH = 1;
const LABEL_FONT = "12px sans-serif";
const LABEL_VERTICAL_OFFSET = 4;

/**
 * Render an `arrow` drawing emission. Strokes the shaft between the
 * two anchors then paints a filled arrowhead at `anchors[1]` via the
 * shared {@link drawArrowhead} helper. When `state.style.label` is
 * set, the label is painted as un-rotated text at the shaft midpoint
 * (the structural `RenderCtx` does not expose `rotate / translate /
 * save / restore`, so on-shaft rotated text is not supported — the
 * label paints horizontally above the midpoint instead). Stroke and
 * fill share `state.style.color`.
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderArrow(ctx, e, view);
 *     void renderArrow;
 */
export function renderArrow(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as ArrowState;
    const from = worldPointToCanvas(state.anchors[0], view);
    const to = worldPointToCanvas(state.anchors[1], view);
    const color = state.style.color ?? DEFAULT_COLOR;
    ctx.strokeStyle = color;
    ctx.lineWidth = state.style.lineWidth ?? DEFAULT_LINE_WIDTH;
    ctx.setLineDash(dashPattern(state.style.lineStyle ?? "solid"));
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    drawArrowhead(ctx, from, to);
    if (state.style.label !== undefined) {
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        ctx.font = LABEL_FONT;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(state.style.label, midX, midY - LABEL_VERTICAL_OFFSET);
    }
}
