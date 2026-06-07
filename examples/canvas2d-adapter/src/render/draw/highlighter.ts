// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Stroke + globalAlpha bracket semantics ported from
//   invinite/src/components/trading-chart/tools/highlighter-tool.ts,
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (HighlighterDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { HighlighterState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear";
import type { Viewport } from "../coords";
import { worldPointToCanvas } from "./worldToCanvas";

const DEFAULT_LINE_WIDTH = 6;

/**
 * Render a `highlighter` drawing emission — a freehand polyline with
 * `ctx.globalAlpha = style.alpha` wrapped around the stroke so the
 * translucency is scoped to this drawing only. Both `style.color` and
 * `style.alpha` are required by the `HighlighterStyle` type. Stroke
 * width defaults to 6 px to match invinite's chunky-highlighter
 * appearance (no `lineWidth` field on `HighlighterStyle`).
 *
 * @since 0.3
 * @experimental
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderHighlighter(ctx, e, view);
 *     void renderHighlighter;
 */
export function renderHighlighter(
    ctx: RenderCtx,
    e: DrawingEmission,
    view: Viewport,
): void {
    const state = e.state as HighlighterState;
    const pts = state.anchors.map((p) => worldPointToCanvas(p, view));
    ctx.strokeStyle = state.style.color;
    ctx.lineWidth = DEFAULT_LINE_WIDTH;
    ctx.globalAlpha = state.style.alpha;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
}
