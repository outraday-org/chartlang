// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Pivot polyline + labelling geometry ported from
//   invinite/src/components/trading-chart/tools/abcd-pattern-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { AbcdPatternState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear.js";
import type { Viewport } from "../coords.js";
import { renderNamedPolyline } from "./namedPolyline.js";
import { worldPointToCanvas } from "./worldToCanvas.js";

const LABELS: ReadonlyArray<string> = ["A", "B", "C", "D"];

/**
 * Render an `abcd-pattern` drawing emission as a 3-leg open polyline
 * through the 4 anchors (A-B-C-D) with each pivot labelled.
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderAbcdPattern(ctx, e, view);
 *     void renderAbcdPattern;
 */
export function renderAbcdPattern(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as AbcdPatternState;
    const points = state.anchors.map((p) => worldPointToCanvas(p, view));
    renderNamedPolyline(ctx, points, LABELS, state.style);
}
