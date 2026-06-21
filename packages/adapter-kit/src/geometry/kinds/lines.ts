// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Stroke + extension geometry moved from the canvas2d adapter's
// per-kind line renderers
//   examples/canvas2d-adapter/src/render/draw/{line,horizontalLine,
//   horizontalRay,verticalLine,crossLine,trendAngle}.ts.
// The originating math is invinite's line / ray / extended-line /
// horizontal-line / horizontal-ray / vertical-line / cross-line /
// trend-angle tools (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02,
// © Invinite); re-licensed MIT for chartlang.

import type {
    CrossLineState,
    HorizontalLineState,
    HorizontalRayState,
    LineState,
    TrendAngleState,
    VerticalLineState,
} from "@invinite-org/chartlang-core";

import { dashPattern } from "../_lib/dash.js";
import { extendLineSegment } from "../_lib/lineExtend.js";
import { strokeOf } from "../_lib/strokeStyle.js";
import { priceToY, timeToX, worldPointToPixel } from "../project.js";
import type { DrawPrimitive, Viewport } from "../types.js";

const DEFAULT_COLOR = "#000000";
const ANGLE_ARC_RADIUS_PX = 24;
const ANGLE_TEXT_FONT = "12px sans-serif";
const ANGLE_TEXT_OFFSET_PX = 6;

/**
 * Decompose a `line` drawing — a single segment, optionally extended to
 * the viewport edges via {@link extendLineSegment} (the `ray` /
 * `extended-line` collapse).
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: LineState;
 *     declare const v: Viewport;
 *     const prims = decomposeLine(s, v);
 *     // prims[0].kind === "polyline"
 *     void prims;
 */
export function decomposeLine(state: LineState, view: Viewport): ReadonlyArray<DrawPrimitive> {
    const a = worldPointToPixel(state.anchors[0], view);
    const b = worldPointToPixel(state.anchors[1], view);
    const { from, to } = extendLineSegment(
        a,
        b,
        { extendLeft: state.style.extendLeft, extendRight: state.style.extendRight },
        view,
    );
    return [{ kind: "polyline", points: [from, to], closed: false, stroke: strokeOf(state.style) }];
}

/**
 * Decompose a `horizontal-line` drawing — a segment from `x = 0` to
 * `x = view.pxWidth` at `priceToY(state.price)`.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: HorizontalLineState;
 *     declare const v: Viewport;
 *     const prims = decomposeHorizontalLine(s, v);
 *     void prims;
 */
export function decomposeHorizontalLine(
    state: HorizontalLineState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const y = priceToY(state.price, view);
    return [
        {
            kind: "polyline",
            points: [
                { x: 0, y },
                { x: view.pxWidth, y },
            ],
            closed: false,
            stroke: strokeOf(state.style),
        },
    ];
}

/**
 * Decompose a `horizontal-ray` drawing — a segment from the projected
 * anchor across the right edge at constant y.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: HorizontalRayState;
 *     declare const v: Viewport;
 *     const prims = decomposeHorizontalRay(s, v);
 *     void prims;
 */
export function decomposeHorizontalRay(
    state: HorizontalRayState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const origin = worldPointToPixel(state.anchor, view);
    return [
        {
            kind: "polyline",
            points: [origin, { x: view.pxWidth, y: origin.y }],
            closed: false,
            stroke: strokeOf(state.style),
        },
    ];
}

/**
 * Decompose a `vertical-line` drawing — a segment from `y = 0` to
 * `y = view.pxHeight` at `timeToX(state.time)`.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: VerticalLineState;
 *     declare const v: Viewport;
 *     const prims = decomposeVerticalLine(s, v);
 *     void prims;
 */
export function decomposeVerticalLine(
    state: VerticalLineState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const x = timeToX(state.time, view);
    return [
        {
            kind: "polyline",
            points: [
                { x, y: 0 },
                { x, y: view.pxHeight },
            ],
            closed: false,
            stroke: strokeOf(state.style),
        },
    ];
}

/**
 * Decompose a `cross-line` drawing — a horizontal segment and a
 * vertical segment crossing at the projected anchor. Two polylines
 * sharing one stroke style.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: CrossLineState;
 *     declare const v: Viewport;
 *     const prims = decomposeCrossLine(s, v);
 *     // prims.length === 2
 *     void prims;
 */
export function decomposeCrossLine(
    state: CrossLineState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const p = worldPointToPixel(state.anchor, view);
    const stroke = strokeOf(state.style);
    return [
        {
            kind: "polyline",
            points: [
                { x: 0, y: p.y },
                { x: view.pxWidth, y: p.y },
            ],
            closed: false,
            stroke,
        },
        {
            kind: "polyline",
            points: [
                { x: p.x, y: 0 },
                { x: p.x, y: view.pxHeight },
            ],
            closed: false,
            stroke,
        },
    ];
}

/**
 * Decompose a `trend-angle` drawing — the main segment, a small arc
 * spanning the screen-space angle off the first anchor, and the angle
 * label in degrees. The arc is solid regardless of `lineStyle` so it
 * reads cleanly; the angle is measured in screen-pixel space with the
 * canvas y-axis flipped (`-dy`) so a positive angle reads "upward to
 * the right" (matching the source renderer's convention).
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: TrendAngleState;
 *     declare const v: Viewport;
 *     const prims = decomposeTrendAngle(s, v);
 *     // prims[0].kind === "polyline"; prims[1].kind === "arc"; prims[2].kind === "text"
 *     void prims;
 */
export function decomposeTrendAngle(
    state: TrendAngleState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const a = worldPointToPixel(state.anchors[0], view);
    const b = worldPointToPixel(state.anchors[1], view);
    const color = state.style.color ?? DEFAULT_COLOR;
    const stroke = strokeOf(state.style);
    const angleRad = Math.atan2(-(b.y - a.y), b.x - a.x);
    const degrees = (angleRad * 180) / Math.PI;
    return [
        { kind: "polyline", points: [a, b], closed: false, stroke },
        {
            kind: "arc",
            cx: a.x,
            cy: a.y,
            r: ANGLE_ARC_RADIUS_PX,
            start: -angleRad,
            end: 0,
            closed: false,
            stroke: { color, width: stroke.width, dash: dashPattern("solid") },
        },
        {
            kind: "text",
            x: a.x + ANGLE_ARC_RADIUS_PX + ANGLE_TEXT_OFFSET_PX,
            y: a.y,
            text: `${degrees.toFixed(1)}°`,
            color,
            font: ANGLE_TEXT_FONT,
            align: "left",
            baseline: "middle",
        },
    ];
}
