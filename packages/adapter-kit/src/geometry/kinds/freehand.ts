// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Freehand geometry moved from the canvas2d adapter's per-kind renderers
//   examples/canvas2d-adapter/src/render/draw/{pen,highlighter,brush}.ts.
// The originating math is invinite's pen / highlighter / brush tools
// (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite);
// re-licensed MIT for chartlang.

import type { BrushState, HighlighterState, PenState } from "@invinite-org/chartlang-core";

import { dashPattern } from "../_lib/dash.js";
import { worldPointToPixel } from "../project.js";
import type { DrawPrimitive, Viewport } from "../types.js";

const DEFAULT_COLOR = "#000000";
const DEFAULT_LINE_WIDTH = 1;

/**
 * Stroke width of a `highlighter` freehand stroke — fixed at 6 px to
 * match invinite's chunky-highlighter appearance (the `HighlighterStyle`
 * type carries no `lineWidth` field), matching the canvas2d source.
 */
const HIGHLIGHTER_LINE_WIDTH = 6;

/**
 * Fill opacity of a `brush` freehand region — fully opaque, mirroring
 * the canvas2d source's `ctx.fill()` at the default `globalAlpha = 1`.
 */
const BRUSH_FILL_ALPHA = 1;

/**
 * Decompose a `pen` drawing — a freehand stroke as one open polyline
 * through the projected anchors, stroke-only with a `LineDrawStyle`.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: PenState;
 *     declare const v: Viewport;
 *     const prims = decomposePen(s, v);
 *     // prims[0].kind === "polyline"; prims[0].closed === false
 *     void prims;
 */
export function decomposePen(state: PenState, view: Viewport): ReadonlyArray<DrawPrimitive> {
    return [
        {
            kind: "polyline",
            points: state.anchors.map((p) => worldPointToPixel(p, view)),
            closed: false,
            stroke: {
                color: state.style.color ?? DEFAULT_COLOR,
                width: state.style.lineWidth ?? DEFAULT_LINE_WIDTH,
                dash: dashPattern(state.style.lineStyle ?? "solid"),
            },
        },
    ];
}

/**
 * Decompose a `highlighter` drawing — a thick translucent freehand
 * stroke as one open polyline. The translucency rides on the IR
 * `StrokeStyle.alpha` (set to `style.alpha`); the painter brackets the
 * `stroke()` in `globalAlpha`, scoping it to this drawing only — exactly
 * the canvas2d source's `globalAlpha` bracket. Width is the fixed
 * {@link HIGHLIGHTER_LINE_WIDTH}; both `color` and `alpha` are required
 * by `HighlighterStyle`.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: HighlighterState;
 *     declare const v: Viewport;
 *     const prims = decomposeHighlighter(s, v);
 *     // prims[0].kind === "polyline"; prims[0].stroke?.alpha is set
 *     void prims;
 */
export function decomposeHighlighter(
    state: HighlighterState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    return [
        {
            kind: "polyline",
            points: state.anchors.map((p) => worldPointToPixel(p, view)),
            closed: false,
            stroke: {
                color: state.style.color,
                width: HIGHLIGHTER_LINE_WIDTH,
                dash: dashPattern("solid"),
                alpha: state.style.alpha,
            },
        },
    ];
}

/**
 * Decompose a `brush` drawing — a freehand region as one closed polyline
 * carrying both a `fill` (`style.fill` at full opacity) and a `stroke`
 * (`style.stroke`, width 1). The painter fills before stroking, so the
 * outline draws on top of the filled region. Both colours are required
 * by `BrushStyle`.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: BrushState;
 *     declare const v: Viewport;
 *     const prims = decomposeBrush(s, v);
 *     // prims[0].kind === "polyline"; prims[0].closed === true
 *     void prims;
 */
export function decomposeBrush(state: BrushState, view: Viewport): ReadonlyArray<DrawPrimitive> {
    return [
        {
            kind: "polyline",
            points: state.anchors.map((p) => worldPointToPixel(p, view)),
            closed: true,
            stroke: {
                color: state.style.stroke,
                width: DEFAULT_LINE_WIDTH,
                dash: dashPattern("solid"),
            },
            fill: { color: state.style.fill, alpha: BRUSH_FILL_ALPHA },
        },
    ];
}
