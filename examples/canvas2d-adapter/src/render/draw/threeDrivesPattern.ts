// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// 6-leg polyline + labelling geometry ported from
//   invinite/src/components/trading-chart/tools/three-drives-pattern-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { ThreeDrivesPatternState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear";
import type { Viewport } from "../coords";
import { renderNamedPolyline } from "./namedPolyline";
import { worldPointToCanvas } from "./worldToCanvas";

const LABELS: ReadonlyArray<string> = ["S", "D1", "R1", "D2", "R2", "D3", "E"];

/**
 * Render a `three-drives-pattern` drawing emission as a 6-leg open
 * polyline through the 7 anchors (start → d1 → r1 → d2 → r2 → d3 → end)
 * with each pivot labelled.
 *
 * @since 0.3
 * @experimental
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderThreeDrivesPattern(ctx, e, view);
 *     void renderThreeDrivesPattern;
 */
export function renderThreeDrivesPattern(
    ctx: RenderCtx,
    e: DrawingEmission,
    view: Viewport,
): void {
    const state = e.state as ThreeDrivesPatternState;
    const points = state.anchors.map((p) => worldPointToCanvas(p, view));
    renderNamedPolyline(ctx, points, LABELS, state.style);
}
