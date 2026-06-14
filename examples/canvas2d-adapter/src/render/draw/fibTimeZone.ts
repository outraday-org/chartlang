// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Level + vertical-zone semantics ported from
//   invinite/src/components/trading-chart/tools/fib-time-zone-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { FibTimeZoneState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear.js";
import { timeToX, type Viewport } from "../coords.js";
import { FIB_LEVELS, formatLevel } from "./fibLevels.js";

const DEFAULT_COLOR = "#facc15";
const DEFAULT_LINE_WIDTH = 1;
const LABEL_FONT = "12px sans-serif";
const LABEL_TOP_PX = 12;
const LABEL_OFFSET_PX = 4;

/**
 * Render a `fib-time-zone` drawing emission as a set of vertical
 * strokes at fib-ratio-spaced times. The renderer uses the ratio array
 * from {@link FIB_LEVELS} (when `style.levels` is omitted) per the
 * landed core shape — see
 * `tasks/phase-3-drawing-parity/11-fibonacci-a.plan.md` §1 for the
 * spec ↔ core delta on the alternative integer-sequence semantics.
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderFibTimeZone(ctx, e, view);
 *     void renderFibTimeZone;
 */
export function renderFibTimeZone(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as FibTimeZoneState;
    const [A, B] = state.anchors;
    const color = state.style.color ?? DEFAULT_COLOR;
    const levels = state.style.levels ?? FIB_LEVELS;
    const timeDelta = B.time - A.time;
    ctx.strokeStyle = color;
    ctx.lineWidth = DEFAULT_LINE_WIDTH;
    ctx.setLineDash([]);
    if (state.style.showLabels === true) {
        ctx.font = LABEL_FONT;
        ctx.fillStyle = color;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
    }
    for (const level of levels) {
        const t = A.time + level * timeDelta;
        const tx = timeToX(t, view);
        ctx.beginPath();
        ctx.moveTo(tx, 0);
        ctx.lineTo(tx, view.pxHeight);
        ctx.stroke();
        if (state.style.showLabels === true) {
            ctx.fillText(formatLevel(level), tx + LABEL_OFFSET_PX, LABEL_TOP_PX);
        }
    }
}
