// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Single-anchor label semantics ported from
//   invinite/src/components/trading-chart/tools/text-tool.ts,
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (TextDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { TextState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear.js";
import type { Viewport } from "../coords.js";
import { resolveTextOpts } from "./textStyle.js";
import { worldPointToCanvas } from "./worldToCanvas.js";

/**
 * Render a `text` drawing emission. Projects the single anchor to
 * canvas pixel space and paints `state.body` using the
 * {@link import("@invinite-org/chartlang-core").TextOpts}-derived font
 * + alignment + color. The renderer does NOT honour `style.bgColor`
 * (the structural `RenderCtx` exposes neither `measureText` nor a
 * background-rect path); `bgColor` is preserved on the wire but unused
 * here. Mirrors `marker.ts`'s text-rendering convention.
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderText(ctx, e, view);
 *     void renderText;
 */
export function renderText(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as TextState;
    const anchor = worldPointToCanvas(state.anchor, view);
    const resolved = resolveTextOpts(state.style);
    ctx.font = resolved.font;
    ctx.textAlign = resolved.textAlign;
    ctx.textBaseline = resolved.textBaseline;
    ctx.fillStyle = resolved.fillStyle;
    ctx.fillText(state.body, anchor.x, anchor.y);
}
