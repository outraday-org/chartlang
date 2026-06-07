// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Open-polyline + per-vertex label render helper shared by the 6
// harmonic-pattern renderers (Task 15). The polyline + labels
// composition mirrors invinite's pattern tools'
// `renderConnectedLegs` + `renderPointLabel` helpers:
//   invinite/src/components/trading-chart/tools/xabcd-pattern-tool.ts
//   invinite/src/components/trading-chart/tools/abcd-pattern-tool.ts
//   (and the other 3 pattern tools), commit
//   078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { LineDrawStyle } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear";
import type { Point2 } from "./bezier";

const DEFAULT_COLOR = "#f59e0b";
const DEFAULT_LINE_WIDTH = 1;
const LABEL_FONT = "11px sans-serif";
const LABEL_OFFSET_PX = 6;

/**
 * Stroke an open polyline through `points` and render each label
 * above its corresponding point. Callers must pre-project world
 * anchors to canvas space (via `worldPointToCanvas`) before invoking
 * this helper — it operates purely on pixel coordinates so the same
 * helper can serve every pattern renderer (xabcd / cypher /
 * headAndShoulders / abcd / trianglePattern / threeDrives).
 *
 * `points.length === labels.length` is a structural contract: every
 * vertex carries exactly one label (X / A / B / C / D / S / H / …).
 * The renderer fills each label `LABEL_OFFSET_PX = 6 px` above its
 * anchor with `textAlign: "center"` + `textBaseline: "bottom"` so
 * labels visually clear the polyline.
 *
 * No-op when `points.length === 0`.
 *
 * @since 0.3
 * @experimental
 * @example
 *     declare const ctx: RenderCtx;
 *     renderNamedPolyline(
 *         ctx,
 *         [{ x: 0, y: 0 }, { x: 10, y: 5 }, { x: 20, y: -2 }],
 *         ["X", "A", "B"],
 *         {},
 *     );
 *     void renderNamedPolyline;
 */
export function renderNamedPolyline(
    ctx: RenderCtx,
    points: ReadonlyArray<Point2>,
    labels: ReadonlyArray<string>,
    style: LineDrawStyle,
): void {
    if (points.length === 0) return;
    const color = style.color ?? DEFAULT_COLOR;
    const lineWidth = style.lineWidth ?? DEFAULT_LINE_WIDTH;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = LABEL_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    for (let i = 0; i < points.length; i++) {
        ctx.fillText(labels[i], points[i].x, points[i].y - LABEL_OFFSET_PX);
    }
}
