// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Up-chevron glyph semantics ported from
//   invinite/src/components/trading-chart/tools/arrow-mark-up-tool.ts,
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (ArrowMarkUpDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { ArrowMarkUpState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear.js";
import type { Viewport } from "../coords.js";
import { drawChevron } from "./chevron.js";
import { worldPointToCanvas } from "./worldToCanvas.js";

const DEFAULT_COLOR = "#22c55e";

/**
 * Render an `arrow-mark-up` drawing emission. Projects the single
 * anchor and paints a filled up-chevron glyph via {@link drawChevron}.
 * Default fill colour is `"#22c55e"` (green) per invinite's paint-time
 * default; an explicit `state.style.color` overrides.
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderArrowMarkUp(ctx, e, view);
 *     void renderArrowMarkUp;
 */
export function renderArrowMarkUp(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as ArrowMarkUpState;
    const anchor = worldPointToCanvas(state.anchor, view);
    drawChevron(ctx, anchor, "up", state.style.color ?? DEFAULT_COLOR);
}
