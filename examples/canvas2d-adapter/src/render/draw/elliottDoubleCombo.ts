// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// 6-leg polyline + labelling geometry ported from
//   invinite/src/components/trading-chart/tools/elliott-double-combo-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { ElliottDoubleComboState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear.js";
import type { Viewport } from "../coords.js";
import { renderNamedPolyline } from "./namedPolyline.js";
import { worldPointToCanvas } from "./worldToCanvas.js";

const DEFAULT_LABELS: ReadonlyArray<string> = ["S", "W", "x1", "X", "x2", "Yi", "Y"];

/**
 * Render an `elliott-double-combo` drawing emission as a 6-leg open
 * polyline through the 7 anchors (start → W-end → x1 → X-end → x2 →
 * Y-mid → Y-end) with each pivot labelled. Honours `state.labels` when
 * present and its length matches the anchor count; otherwise falls
 * back to the default `["S", "W", "x1", "X", "x2", "Yi", "Y"]` labels.
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderElliottDoubleCombo(ctx, e, view);
 *     void renderElliottDoubleCombo;
 */
export function renderElliottDoubleCombo(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as ElliottDoubleComboState;
    const points = state.anchors.map((p) => worldPointToCanvas(p, view));
    const labels =
        state.labels !== undefined && state.labels.length === points.length
            ? state.labels
            : DEFAULT_LABELS;
    renderNamedPolyline(ctx, points, labels, { color: "#14b8a6", ...state.style });
}
