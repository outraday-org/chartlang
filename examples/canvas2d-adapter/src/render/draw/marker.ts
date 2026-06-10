// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Glyph + text-alignment semantics ported from
//   invinite/src/components/trading-chart/tools/marker-tool.ts,
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (MarkerDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { MarkerState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear";
import type { Viewport } from "../coords";
import { resolveTextOpts } from "./textStyle";
import { worldPointToCanvas } from "./worldToCanvas";

/**
 * Render a `marker` drawing emission. Projects the single anchor to
 * canvas pixel space and paints the marker's `text` (when set) using
 * the {@link TextOpts}-derived font + alignment. When `text` is empty
 * or undefined the renderer issues NO calls — a pure no-op, since
 * marker glyphs without text are an interactive-tool concern that
 * lands with Task 20's `defineDrawing` follow-up. The renderer does
 * NOT honour `style.bgColor` (no rectangle behind the text) — that
 * landed-Task-1 `TextOpts` field is preserved on the wire but not
 * painted in the reference adapter.
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderMarker(ctx, e, view);
 *     void renderMarker;
 */
export function renderMarker(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as MarkerState;
    if (state.text === undefined || state.text.length === 0) return;
    const anchor = worldPointToCanvas(state.anchor, view);
    const resolved = resolveTextOpts(state.style);
    ctx.font = resolved.font;
    ctx.textAlign = resolved.textAlign;
    ctx.textBaseline = resolved.textBaseline;
    ctx.fillStyle = resolved.fillStyle;
    ctx.fillText(state.text, anchor.x, anchor.y);
}
