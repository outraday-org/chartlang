// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// 6-leg polyline + labelling geometry ported from
//   invinite/src/components/trading-chart/tools/elliott-triple-combo-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Note: invinite's full triple-combo schema carries 10 anchors; the
// landed `ElliottTripleComboState.anchors: AnchorHept` is the 7-anchor
// shell — flagged as Task-1 reshape follow-up.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { ElliottTripleComboState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear";
import type { Viewport } from "../coords";
import { renderNamedPolyline } from "./namedPolyline";
import { worldPointToCanvas } from "./worldToCanvas";

const DEFAULT_LABELS: ReadonlyArray<string> = ["S", "W", "X1", "Y", "X2", "Zi", "Z"];

/**
 * Render an `elliott-triple-combo` drawing emission as a 6-leg open
 * polyline through the 7 anchors (start → W-end → X1-end → Y-end →
 * X2-end → Z-mid → Z-end) with each pivot labelled. Honours
 * `state.labels` when present and its length matches the anchor count;
 * otherwise falls back to the default `["S", "W", "X1", "Y", "X2",
 * "Zi", "Z"]` labels.
 *
 * @since 0.3
 * @experimental
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderElliottTripleCombo(ctx, e, view);
 *     void renderElliottTripleCombo;
 */
export function renderElliottTripleCombo(
    ctx: RenderCtx,
    e: DrawingEmission,
    view: Viewport,
): void {
    const state = e.state as ElliottTripleComboState;
    const points = state.anchors.map((p) => worldPointToCanvas(p, view));
    const labels =
        state.labels !== undefined && state.labels.length === points.length
            ? state.labels
            : DEFAULT_LABELS;
    renderNamedPolyline(ctx, points, labels, { color: "#14b8a6", ...state.style });
}
