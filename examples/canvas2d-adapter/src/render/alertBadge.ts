// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { AlertEmission } from "@invinite-org/chartlang-adapter-kit";

import type { Palette } from "../palette.js";
import type { RenderCtx } from "./clear.js";

const BADGE_RADIUS = 4;
const TWO_PI = Math.PI * 2;

function colorFor(alert: AlertEmission, palette: Palette): string {
    switch (alert.severity) {
        case "info":
            return palette.alertInfo;
        case "warning":
            return palette.alertWarning;
        case "critical":
            return palette.alertCritical;
    }
}

/**
 * Anchor point an alert badge renders at — typically `timeToX` of the
 * alert's bar plus `priceToY` of that bar's `high - ε`. Carried as a
 * parameter (not derived from the alert payload) so this helper stays
 * pure and the anchor selection lives in `onEmissions` where the bar
 * window state is already in scope.
 *
 * @since 0.1
 * @stable
 * @example
 *     const a: AlertAnchor = { x: 100, y: 50 };
 *     void a;
 */
export type AlertAnchor = {
    readonly x: number;
    readonly y: number;
};

/**
 * Draw a small filled circle at `anchor`, colour-coded by the alert's
 * severity. Exactly one `arc` + `fill` is issued per call so tests can
 * pin the call count against the alert count.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const alert: AlertEmission;
 *     declare const anchor: AlertAnchor;
 *     declare const palette: Palette;
 *     drawAlertBadge(ctx, alert, anchor, palette);
 *     void drawAlertBadge;
 */
export function drawAlertBadge(
    ctx: RenderCtx,
    alert: AlertEmission,
    anchor: AlertAnchor,
    palette: Palette,
): void {
    ctx.fillStyle = colorFor(alert, palette);
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y, BADGE_RADIUS, 0, TWO_PI);
    ctx.closePath();
    ctx.fill();
}
