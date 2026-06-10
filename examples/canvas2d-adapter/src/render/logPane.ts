// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { LogEmission } from "@invinite-org/chartlang-adapter-kit";

import type { Palette } from "../palette.js";
import type { RenderCtx } from "./clear.js";
import type { Viewport } from "./coords.js";

const MAX_VISIBLE_LOGS = 5;
const PADDING = 8;
const ROW_HEIGHT = 13;
const FONT = "11px sans-serif";

/**
 * Render a compact latest-log pane at the bottom-left of the chart.
 *
 * @since 0.5
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const viewport: Viewport;
 *     declare const palette: Palette;
 *     drawLogPane(ctx, [], viewport, palette);
 */
export function drawLogPane(
    ctx: RenderCtx,
    logs: ReadonlyArray<LogEmission>,
    viewport: Viewport,
    palette: Palette,
): void {
    const visible = logs.slice(-MAX_VISIBLE_LOGS);
    if (visible.length === 0) return;
    const x = PADDING;
    const y = Math.max(PADDING, viewport.pxHeight - PADDING - visible.length * ROW_HEIGHT);
    ctx.fillStyle = palette.plotDefault;
    ctx.font = FONT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    for (let i = 0; i < visible.length; i += 1) {
        const log = visible[i];
        ctx.fillText(`[${log.level}] ${log.message}`, x, y + i * ROW_HEIGHT);
    }
}
