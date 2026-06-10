// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Square-of-nine semantics ported from
//   invinite/src/components/trading-chart/tools/gann-square-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { GannSquareState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear.js";
import type { Viewport } from "../coords.js";
import { GANN_LEVELS } from "./gannLevels.js";
import { worldPointToCanvas } from "./worldToCanvas.js";

const DEFAULT_COLOR = "#a855f7";
const DEFAULT_LINE_WIDTH = 1;

/**
 * Render a `gann-square` drawing emission as a square anchored at
 * `anchors[0]`, with side `max(|dx|, |dy|)` in canvas space (the
 * Gann-1×1 default). Subdivisions follow {@link GANN_LEVELS}.
 * Per-instance ratio overrides are deferred to a Task-1 reshape
 * follow-up.
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderGannSquare(ctx, e, view);
 *     void renderGannSquare;
 */
export function renderGannSquare(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as GannSquareState;
    const a = worldPointToCanvas(state.anchors[0], view);
    const b = worldPointToCanvas(state.anchors[1], view);
    const side = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    const signX = b.x >= a.x ? 1 : -1;
    const signY = b.y >= a.y ? 1 : -1;
    const left = signX === 1 ? a.x : a.x - side;
    const right = signX === 1 ? a.x + side : a.x;
    const top = signY === 1 ? a.y : a.y - side;
    const bottom = signY === 1 ? a.y + side : a.y;
    const color = state.style.color ?? DEFAULT_COLOR;
    ctx.strokeStyle = color;
    ctx.lineWidth = state.style.lineWidth ?? DEFAULT_LINE_WIDTH;
    ctx.setLineDash([]);
    for (const level of GANN_LEVELS) {
        const y = top + level * side;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.stroke();
    }
    for (const level of GANN_LEVELS) {
        const x = left + level * side;
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
        ctx.stroke();
    }
}
