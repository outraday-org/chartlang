// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Compact glyph composition ported from
//   invinite/src/components/trading-chart/tools/arrow-marker-tool.ts,
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (ArrowMarkerDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { ArrowMarkerState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear.js";
import type { Viewport } from "../coords.js";
import { drawArrowhead } from "./arrowhead.js";
import { worldPointToCanvas } from "./worldToCanvas.js";

// Defaults to invinite's toolbar blue per y-doc-bridge.ts comment.
const DEFAULT_COLOR = "#3b82f6";
const DEFAULT_LINE_WIDTH = 1;
const DOT_RADIUS = 3;
const STUB_DX = 16;
const STUB_DY = -8;
const TEXT_OFFSET_X = 6;
const TEXT_FONT = "12px sans-serif";

/**
 * Render an `arrow-marker` drawing emission. Paints a self-contained
 * compact glyph at `state.anchor`: a small filled dot, a short stub
 * line up + right, and a filled arrowhead at the stub end. Optional
 * `state.style.text` paints to the right of the anchor. The
 * single-anchor `ArrowMarkerState` shape diverges from invinite's
 * two-anchor `ArrowMarkerDrawing` per Task 1's landed core shape —
 * the renderer therefore composes a self-contained glyph rather than
 * stroking a shaft to a second anchor. Default colour is `"#3b82f6"`
 * (invinite toolbar blue).
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderArrowMarker(ctx, e, view);
 *     void renderArrowMarker;
 */
export function renderArrowMarker(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as ArrowMarkerState;
    const anchor = worldPointToCanvas(state.anchor, view);
    const color = state.style.color ?? DEFAULT_COLOR;
    const stubEnd = { x: anchor.x + STUB_DX, y: anchor.y + STUB_DY };

    // Filled dot at the anchor.
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y, DOT_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Short stub line from anchor to the stub end.
    ctx.strokeStyle = color;
    ctx.lineWidth = DEFAULT_LINE_WIDTH;
    ctx.beginPath();
    ctx.moveTo(anchor.x, anchor.y);
    ctx.lineTo(stubEnd.x, stubEnd.y);
    ctx.stroke();

    // Arrowhead at the stub end pointing along the stub direction.
    drawArrowhead(ctx, anchor, stubEnd);

    // Optional text label to the right of the anchor dot.
    if (state.style.text !== undefined) {
        ctx.font = TEXT_FONT;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(state.style.text, anchor.x + TEXT_OFFSET_X, anchor.y);
    }
}
