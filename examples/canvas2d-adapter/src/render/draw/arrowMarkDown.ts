// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Down-chevron glyph semantics ported from
//   invinite/src/components/trading-chart/tools/arrow-mark-down-tool.ts,
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (ArrowMarkDownDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { ArrowMarkDownState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear.js";
import type { Viewport } from "../coords.js";
import { drawChevron } from "./chevron.js";
import { worldPointToCanvas } from "./worldToCanvas.js";

const DEFAULT_COLOR = "#ef4444";

/**
 * Render an `arrow-mark-down` drawing emission. Projects the single
 * anchor and paints a filled down-chevron glyph via
 * {@link drawChevron}. Default fill colour is `"#ef4444"` (red) per
 * invinite's paint-time default; an explicit `state.style.color`
 * overrides.
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderArrowMarkDown(ctx, e, view);
 *     void renderArrowMarkDown;
 */
export function renderArrowMarkDown(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as ArrowMarkDownState;
    const anchor = worldPointToCanvas(state.anchor, view);
    drawChevron(ctx, anchor, "down", state.style.color ?? DEFAULT_COLOR);
}
