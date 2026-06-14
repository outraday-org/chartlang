// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// 4-leg polyline + labelling geometry ported from
//   invinite/src/components/trading-chart/tools/elliott-impulse-wave-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { ElliottImpulseWaveState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear.js";
import type { Viewport } from "../coords.js";
import { renderNamedPolyline } from "./namedPolyline.js";
import { worldPointToCanvas } from "./worldToCanvas.js";

const DEFAULT_LABELS: ReadonlyArray<string> = ["1", "2", "3", "4", "5"];

/**
 * Render an `elliott-impulse-wave` drawing emission as a 4-leg open
 * polyline through the 5 anchors (1-2-3-4-5) with each pivot labelled.
 * Honours `state.labels` when present and its length matches the
 * anchor count; otherwise falls back to the default `["1", "2", "3",
 * "4", "5"]` labels.
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderElliottImpulseWave(ctx, e, view);
 *     void renderElliottImpulseWave;
 */
export function renderElliottImpulseWave(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as ElliottImpulseWaveState;
    const points = state.anchors.map((p) => worldPointToCanvas(p, view));
    const labels =
        state.labels !== undefined && state.labels.length === points.length
            ? state.labels
            : DEFAULT_LABELS;
    renderNamedPolyline(ctx, points, labels, { color: "#14b8a6", ...state.style });
}
