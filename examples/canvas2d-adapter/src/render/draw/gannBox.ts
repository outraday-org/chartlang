// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Box subdivision semantics ported from
//   invinite/src/components/trading-chart/tools/gann-box-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { GannBoxState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear.js";
import type { Viewport } from "../coords.js";
import { GANN_LEVELS } from "./gannLevels.js";
import { worldPointToCanvas } from "./worldToCanvas.js";

const DEFAULT_COLOR = "#a855f7";
const DEFAULT_LINE_WIDTH = 1;

/**
 * Render a `gann-box` drawing emission as a ratio grid spanning the
 * bounding rectangle of two world anchors. Strokes one horizontal +
 * one vertical line at each {@link GANN_LEVELS} entry (5 + 5 = 10
 * strokes for the default 1/4 subdivisions, including the outer
 * rectangle at level 0 and 1.0).
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderGannBox(ctx, e, view);
 *     void renderGannBox;
 */
export function renderGannBox(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as GannBoxState;
    const a = worldPointToCanvas(state.anchors[0], view);
    const b = worldPointToCanvas(state.anchors[1], view);
    const left = Math.min(a.x, b.x);
    const right = Math.max(a.x, b.x);
    const top = Math.min(a.y, b.y);
    const bottom = Math.max(a.y, b.y);
    const color = state.style.color ?? DEFAULT_COLOR;
    ctx.strokeStyle = color;
    ctx.lineWidth = state.style.lineWidth ?? DEFAULT_LINE_WIDTH;
    ctx.setLineDash([]);
    for (const level of GANN_LEVELS) {
        const y = top + level * (bottom - top);
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.stroke();
    }
    for (const level of GANN_LEVELS) {
        const x = left + level * (right - left);
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
        ctx.stroke();
    }
}
