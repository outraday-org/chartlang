// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Fixed-pixel square semantics ported from
//   invinite/src/components/trading-chart/tools/gann-square-fixed-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { GannSquareFixedState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear";
import type { Viewport } from "../coords";
import { GANN_LEVELS } from "./gannLevels";
import { worldPointToCanvas } from "./worldToCanvas";

const DEFAULT_COLOR = "#a855f7";
const DEFAULT_LINE_WIDTH = 1;
const SIDE_PX = 80;

/**
 * Render a `gann-square-fixed` drawing emission as an `80×80` pixel
 * square anchored at the supplied world point, subdivided by
 * {@link GANN_LEVELS}. The fixed pixel side mirrors invinite's
 * cursor-distance-derived size at paint time (Phase-3 ships a
 * deterministic constant; custom sizing is a Task-1 reshape
 * follow-up).
 *
 * @since 0.3
 * @experimental
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderGannSquareFixed(ctx, e, view);
 *     void renderGannSquareFixed;
 */
export function renderGannSquareFixed(
    ctx: RenderCtx,
    e: DrawingEmission,
    view: Viewport,
): void {
    const state = e.state as GannSquareFixedState;
    const origin = worldPointToCanvas(state.anchor, view);
    const left = origin.x;
    const right = origin.x + SIDE_PX;
    const top = origin.y;
    const bottom = origin.y + SIDE_PX;
    const color = state.style.color ?? DEFAULT_COLOR;
    ctx.strokeStyle = color;
    ctx.lineWidth = state.style.lineWidth ?? DEFAULT_LINE_WIDTH;
    ctx.setLineDash([]);
    for (const level of GANN_LEVELS) {
        const y = top + level * SIDE_PX;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.stroke();
    }
    for (const level of GANN_LEVELS) {
        const x = left + level * SIDE_PX;
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
        ctx.stroke();
    }
}
