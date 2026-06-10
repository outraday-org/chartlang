// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Triangle pattern outline render derived from
//   invinite/src/components/trading-chart/tools/triangle-pattern-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Note: distinct from `draw.triangle` (Task 6) — this renders a
// 3-anchor harmonic-pattern outline with `LineDrawStyle`, not a
// solid-shape primitive with `ShapeStyle`.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { TrianglePatternState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear";
import type { Viewport } from "../coords";
import { renderNamedPolyline } from "./namedPolyline";
import { worldPointToCanvas } from "./worldToCanvas";

const LABELS: ReadonlyArray<string> = ["A", "B", "C"];

/**
 * Render a `triangle-pattern` drawing emission as a 2-leg open
 * polyline through the 3 anchors (A-B-C) with each pivot labelled.
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderTrianglePattern(ctx, e, view);
 *     void renderTrianglePattern;
 */
export function renderTrianglePattern(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as TrianglePatternState;
    const points = state.anchors.map((p) => worldPointToCanvas(p, view));
    renderNamedPolyline(ctx, points, LABELS, state.style);
}
