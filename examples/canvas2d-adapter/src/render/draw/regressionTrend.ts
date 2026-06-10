// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Anchor + opts semantics ported from
//   invinite/src/components/trading-chart/tools/regression-trend-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { RegressionTrendState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear";
import type { Viewport } from "../coords";
import { dashPattern } from "../lineDash";
import { worldPointToCanvas } from "./worldToCanvas";

const DEFAULT_COLOR = "#3b82f6";
const DEFAULT_LINE_WIDTH = 1;

/**
 * Render a `regression-trend` drawing emission. The reference canvas2d
 * adapter renders a placeholder line between the two world anchors —
 * the actual OLS fit + σ bands require bar-buffer access which
 * `Viewport` does not expose; consumer adapters that DO have a bar
 * buffer can compute the fit via the public
 * {@link import("@invinite-org/chartlang-runtime").linearRegression}
 * helper (re-exported by Phase 3 Task 10). See
 * `tasks/phase-3-drawing-parity/10-channels.plan.md` §3 for the
 * deferred-fidelity flag.
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderRegressionTrend(ctx, e, view);
 *     void renderRegressionTrend;
 */
export function renderRegressionTrend(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as RegressionTrendState;
    const a = worldPointToCanvas(state.anchors[0], view);
    const b = worldPointToCanvas(state.anchors[1], view);
    ctx.strokeStyle = state.style.color ?? DEFAULT_COLOR;
    ctx.lineWidth = DEFAULT_LINE_WIDTH;
    ctx.setLineDash(dashPattern("solid"));
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
}
