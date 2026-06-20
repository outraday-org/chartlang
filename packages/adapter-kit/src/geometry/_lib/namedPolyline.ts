// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Open-polyline + per-vertex label composition mirrors invinite's
// pattern tools' `renderConnectedLegs` + `renderPointLabel` helpers:
//   invinite/src/components/trading-chart/tools/xabcd-pattern-tool.ts
//   invinite/src/components/trading-chart/tools/abcd-pattern-tool.ts
//   (and the other 3 pattern tools), commit
//   078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang.

import type { LineDrawStyle } from "@invinite-org/chartlang-core";

import type { DrawPrimitive, Point2 } from "../types.js";
import { dashPattern } from "./dash.js";

const DEFAULT_COLOR = "#f59e0b";
const DEFAULT_LINE_WIDTH = 1;
const LABEL_FONT = "11px sans-serif";
const LABEL_OFFSET_PX = 6;

/**
 * Reduce an open labelled polyline to `DrawPrimitive[]`: one open
 * `polyline` through `points` plus one `text` primitive per vertex,
 * each label `LABEL_OFFSET_PX = 6 px` above its anchor with
 * `align: "center"` / `baseline: "bottom"`. Consumed by the harmonic
 * pattern decomposers (Tasks 2–3). Returns `[]` when `points` is empty.
 *
 * `points.length === labels.length` is a structural contract: every
 * vertex carries exactly one label (X / A / B / C / D / S / H / …).
 *
 * @since 1.3
 * @stable
 * @example
 *     const prims = namedPolylinePrimitives(
 *         [{ x: 0, y: 0 }, { x: 10, y: 5 }],
 *         ["X", "A"],
 *         {},
 *     );
 *     // prims[0].kind === "polyline"; prims[1].kind === "text"
 *     void prims;
 */
export function namedPolylinePrimitives(
    points: ReadonlyArray<Point2>,
    labels: ReadonlyArray<string>,
    style: LineDrawStyle,
): ReadonlyArray<DrawPrimitive> {
    if (points.length === 0) return [];
    const color = style.color ?? DEFAULT_COLOR;
    const lineWidth = style.lineWidth ?? DEFAULT_LINE_WIDTH;
    const out: DrawPrimitive[] = [
        {
            kind: "polyline",
            points,
            closed: false,
            stroke: { color, width: lineWidth, dash: dashPattern("solid") },
        },
    ];
    for (let i = 0; i < points.length; i++) {
        out.push({
            kind: "text",
            x: points[i].x,
            y: points[i].y - LABEL_OFFSET_PX,
            text: labels[i],
            color,
            font: LABEL_FONT,
            align: "center",
            baseline: "bottom",
        });
    }
    return out;
}
