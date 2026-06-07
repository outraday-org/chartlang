// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// 2-leg polyline + labelling geometry ported from
//   invinite/src/components/trading-chart/tools/elliott-correction-wave-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { ElliottCorrectionWaveState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear";
import type { Viewport } from "../coords";
import { renderNamedPolyline } from "./namedPolyline";
import { worldPointToCanvas } from "./worldToCanvas";

const DEFAULT_LABELS: ReadonlyArray<string> = ["A", "B", "C"];

/**
 * Render an `elliott-correction-wave` drawing emission as a 2-leg open
 * polyline through the 3 anchors (A-B-C) with each pivot labelled.
 * Honours `state.labels` when present and its length matches the
 * anchor count; otherwise falls back to the default `["A", "B", "C"]`
 * labels.
 *
 * @since 0.3
 * @experimental
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderElliottCorrectionWave(ctx, e, view);
 *     void renderElliottCorrectionWave;
 */
export function renderElliottCorrectionWave(
    ctx: RenderCtx,
    e: DrawingEmission,
    view: Viewport,
): void {
    const state = e.state as ElliottCorrectionWaveState;
    const points = state.anchors.map((p) => worldPointToCanvas(p, view));
    const labels =
        state.labels !== undefined && state.labels.length === points.length
            ? state.labels
            : DEFAULT_LABELS;
    renderNamedPolyline(ctx, points, labels, { color: "#14b8a6", ...state.style });
}
