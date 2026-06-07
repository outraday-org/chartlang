// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Stroke + extension semantics ported from
//   invinite/src/components/trading-chart/tools/line-tool.ts,
//   invinite/src/components/trading-chart/tools/ray-tool.ts,
//   invinite/src/components/trading-chart/tools/extended-line-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { LineState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear";
import type { Viewport } from "../coords";
import { dashPattern } from "../lineDash";
import { extendLineSegment } from "./lineExtend";
import { worldPointToCanvas } from "./worldToCanvas";

const DEFAULT_COLOR = "#000000";
const DEFAULT_LINE_WIDTH = 1;

/**
 * Render a `line` drawing emission. Honours `LineDrawStyle.extendLeft`
 * / `extendRight` via {@link extendLineSegment} so the same renderer
 * covers the invinite `line` / `ray` / `extended-line` tool collapse.
 *
 * The renderer falls back to `"#000000"` when `style.color` is
 * omitted — Phase-3 drawings don't take a palette argument per
 * {@link drawingDispatch}'s pinned signature. The dash array is reset
 * to solid after the stroke so downstream draws are unaffected.
 *
 * @since 0.3
 * @experimental
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderLine(ctx, e, view);
 *     void renderLine;
 */
export function renderLine(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as LineState;
    const a = worldPointToCanvas(state.anchors[0], view);
    const b = worldPointToCanvas(state.anchors[1], view);
    const { from, to } = extendLineSegment(
        a,
        b,
        { extendLeft: state.style.extendLeft, extendRight: state.style.extendRight },
        view,
    );
    ctx.strokeStyle = state.style.color ?? DEFAULT_COLOR;
    ctx.lineWidth = state.style.lineWidth ?? DEFAULT_LINE_WIDTH;
    ctx.setLineDash(dashPattern(state.style.lineStyle ?? "solid"));
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.setLineDash([]);
}
