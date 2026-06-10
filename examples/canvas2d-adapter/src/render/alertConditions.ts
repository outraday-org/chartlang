// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { AlertConditionEmission } from "@invinite-org/chartlang-adapter-kit";

import type { Palette } from "../palette.js";
import type { RenderCtx } from "./clear.js";
import type { Viewport } from "./coords.js";

const PANEL_X_PAD = 12;
const PANEL_Y = 18;
const ROW_HEIGHT = 14;
const FONT = "11px sans-serif";

/**
 * Draw fired alert conditions for the current bar as a compact side
 * panel. Non-fired emissions are ignored; they still travel on the wire
 * so hosts can model state transitions.
 *
 * @since 0.5
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const viewport: Viewport;
 *     declare const palette: Palette;
 *     drawAlertConditions(ctx, [], viewport, palette);
 */
export function drawAlertConditions(
    ctx: RenderCtx,
    conditions: ReadonlyArray<AlertConditionEmission>,
    viewport: Viewport,
    palette: Palette,
): void {
    const fired = conditions.filter((condition) => condition.fired);
    if (fired.length === 0) return;

    const x = Math.max(PANEL_X_PAD, viewport.pxWidth - 180);
    ctx.fillStyle = palette.plotDefault;
    ctx.font = FONT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    for (let i = 0; i < fired.length; i++) {
        const condition = fired[i];
        const label = `${condition.conditionId}: ${condition.defaultMessage}`;
        ctx.fillText(label, x, PANEL_Y + i * ROW_HEIGHT);
    }
}
