// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Stroke + fill geometry moved from the canvas2d adapter's per-kind
// shape renderers
//   examples/canvas2d-adapter/src/render/draw/{rectangle,
//   rotatedRectangle,triangle,polyline,circle,ellipse,path,
//   fillBetween}.ts.
// The originating math is invinite's rectangle / rotated-rectangle /
// triangle / polyline / circle / ellipse / path tools (commit
// 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite); re-licensed
// MIT for chartlang.

import type {
    CircleState,
    EllipseState,
    FillBetweenState,
    PathState,
    PolylineState,
    RectangleState,
    RotatedRectangleState,
    TriangleState,
} from "@invinite-org/chartlang-core";

import { dashPattern } from "../_lib/dash.js";
import { resolveShapeStyle } from "../_lib/shapeStyle.js";
import { worldPointToPixel } from "../project.js";
import type { DrawPrimitive, Point2, Viewport } from "../types.js";

const DEFAULT_LINE_WIDTH = 1;
const DEFAULT_FILL_ALPHA = 1;
const TWO_PI = Math.PI * 2;

/**
 * Number of polyline segments used to approximate an `ellipse`. 64
 * segments give visually smooth strokes at typical viewport widths
 * (≈800 px) while keeping the primitive list bounded — matching the
 * canvas2d source renderer exactly.
 */
const ELLIPSE_SEGMENTS = 64;

/**
 * Decompose a `rectangle` drawing — a closed 4-corner polygon derived
 * from the axis-aligned bounding box of the two projected anchors.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: RectangleState;
 *     declare const v: Viewport;
 *     const prims = decomposeRectangle(s, v);
 *     // prims[0].kind === "polyline"; prims[0].closed === true
 *     void prims;
 */
export function decomposeRectangle(
    state: RectangleState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const a = worldPointToPixel(state.anchors[0], view);
    const b = worldPointToPixel(state.anchors[1], view);
    const xMin = Math.min(a.x, b.x);
    const xMax = Math.max(a.x, b.x);
    const yMin = Math.min(a.y, b.y);
    const yMax = Math.max(a.y, b.y);
    const { stroke, fill } = resolveShapeStyle(state.style);
    return [
        {
            kind: "polyline",
            points: [
                { x: xMin, y: yMin },
                { x: xMax, y: yMin },
                { x: xMax, y: yMax },
                { x: xMin, y: yMax },
            ],
            closed: true,
            stroke,
            ...(fill === undefined ? {} : { fill }),
        },
    ];
}

/**
 * Decompose a `rotated-rectangle` drawing — a closed polygon through
 * the four projected anchors (carried in stroke order, so no matrix
 * math is needed).
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: RotatedRectangleState;
 *     declare const v: Viewport;
 *     const prims = decomposeRotatedRectangle(s, v);
 *     void prims;
 */
export function decomposeRotatedRectangle(
    state: RotatedRectangleState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const points = state.anchors.map((p) => worldPointToPixel(p, view));
    const { stroke, fill } = resolveShapeStyle(state.style);
    return [
        {
            kind: "polyline",
            points,
            closed: true,
            stroke,
            ...(fill === undefined ? {} : { fill }),
        },
    ];
}

/**
 * Decompose a `triangle` drawing — a closed 3-vertex polygon.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: TriangleState;
 *     declare const v: Viewport;
 *     const prims = decomposeTriangle(s, v);
 *     void prims;
 */
export function decomposeTriangle(
    state: TriangleState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const points = state.anchors.map((p) => worldPointToPixel(p, view));
    const { stroke, fill } = resolveShapeStyle(state.style);
    return [
        {
            kind: "polyline",
            points,
            closed: true,
            stroke,
            ...(fill === undefined ? {} : { fill }),
        },
    ];
}

/**
 * Decompose a `polyline` drawing — a closed N-vertex polyline carrying
 * a `LineDrawStyle` (no fill).
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: PolylineState;
 *     declare const v: Viewport;
 *     const prims = decomposePolyline(s, v);
 *     // prims[0].closed === true
 *     void prims;
 */
export function decomposePolyline(
    state: PolylineState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const points = state.anchors.map((p) => worldPointToPixel(p, view));
    return [
        {
            kind: "polyline",
            points,
            closed: true,
            stroke: {
                color: state.style.color ?? "#000000",
                width: state.style.lineWidth ?? DEFAULT_LINE_WIDTH,
                dash: dashPattern(state.style.lineStyle ?? "solid"),
            },
        },
    ];
}

/**
 * Decompose a `circle` drawing — an arc whose radius is the projected
 * pixel distance between the centre anchor and the radius anchor (so
 * the stroke keeps the same apparent thickness across zoom changes).
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: CircleState;
 *     declare const v: Viewport;
 *     const prims = decomposeCircle(s, v);
 *     // prims[0].kind === "arc"
 *     void prims;
 */
export function decomposeCircle(state: CircleState, view: Viewport): ReadonlyArray<DrawPrimitive> {
    const centre = worldPointToPixel(state.anchors[0], view);
    const edge = worldPointToPixel(state.anchors[1], view);
    const radius = Math.hypot(edge.x - centre.x, edge.y - centre.y);
    const { stroke, fill } = resolveShapeStyle(state.style);
    return [
        {
            kind: "arc",
            cx: centre.x,
            cy: centre.y,
            r: radius,
            start: 0,
            end: TWO_PI,
            stroke,
            ...(fill === undefined ? {} : { fill }),
        },
    ];
}

/**
 * Decompose an axis-aligned `ellipse` drawing — a closed
 * {@link ELLIPSE_SEGMENTS}-segment polyline inscribed in the bounding
 * box of the two anchors. Rotated ellipses are out of scope.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: EllipseState;
 *     declare const v: Viewport;
 *     const prims = decomposeEllipse(s, v);
 *     void prims;
 */
export function decomposeEllipse(
    state: EllipseState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const a = worldPointToPixel(state.anchors[0], view);
    const b = worldPointToPixel(state.anchors[1], view);
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const rx = Math.abs(b.x - a.x) / 2;
    const ry = Math.abs(b.y - a.y) / 2;
    const points: Point2[] = [{ x: cx + rx, y: cy }];
    for (let i = 1; i < ELLIPSE_SEGMENTS; i++) {
        const theta = (i / ELLIPSE_SEGMENTS) * TWO_PI;
        points.push({ x: cx + rx * Math.cos(theta), y: cy + ry * Math.sin(theta) });
    }
    const { stroke, fill } = resolveShapeStyle(state.style);
    return [
        {
            kind: "polyline",
            points,
            closed: true,
            stroke,
            ...(fill === undefined ? {} : { fill }),
        },
    ];
}

/**
 * Decompose a `path` drawing — an OPEN N-vertex polyline (unless
 * `style.closed === true`) carrying a `PathOpts` style (no fill).
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: PathState;
 *     declare const v: Viewport;
 *     const prims = decomposePath(s, v);
 *     void prims;
 */
export function decomposePath(state: PathState, view: Viewport): ReadonlyArray<DrawPrimitive> {
    const points = state.anchors.map((p) => worldPointToPixel(p, view));
    return [
        {
            kind: "polyline",
            points,
            closed: state.style.closed === true,
            stroke: {
                color: state.style.color ?? "#000000",
                width: state.style.lineWidth ?? DEFAULT_LINE_WIDTH,
                dash: dashPattern(state.style.lineStyle ?? "solid"),
            },
        },
    ];
}

/**
 * Decompose a `fill-between` drawing — a closed filled polygon walking
 * `edgeA` forward then `edgeB` in reverse. The optional outline strokes
 * only when `style.color` is set; the band fills only when `style.fill`
 * is set. A degenerate edge (`< 1` point) or a non-finite mapped anchor
 * is a silent no-op (returns `[]`), matching the source renderer's
 * warmup behaviour.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: FillBetweenState;
 *     declare const v: Viewport;
 *     const prims = decomposeFillBetween(s, v);
 *     void prims;
 */
export function decomposeFillBetween(
    state: FillBetweenState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const a = state.edgeA.map((p) => worldPointToPixel(p, view));
    const b = state.edgeB.map((p) => worldPointToPixel(p, view));
    if (a.length < 1 || b.length < 1) return [];
    if (a.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return [];
    if (b.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return [];
    const points: Point2[] = [...a];
    for (let i = b.length - 1; i >= 0; i--) points.push(b[i]);
    const { color, fill } = state.style;
    return [
        {
            kind: "polyline",
            points,
            closed: true,
            ...(color === undefined
                ? {}
                : {
                      stroke: {
                          color,
                          width: state.style.lineWidth ?? DEFAULT_LINE_WIDTH,
                          dash: dashPattern(state.style.lineStyle ?? "solid"),
                      },
                  }),
            ...(fill === undefined
                ? {}
                : { fill: { color: fill, alpha: state.style.fillAlpha ?? DEFAULT_FILL_ALPHA } }),
        },
    ];
}
