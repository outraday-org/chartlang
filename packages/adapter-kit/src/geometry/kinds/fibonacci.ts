// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Fibonacci geometry moved from the canvas2d adapter's per-kind
// renderers
//   examples/canvas2d-adapter/src/render/draw/{fibRetracement,
//   fibTrendExtension,fibChannel,fibTimeZone,fibWedge,fibSpeedFan,
//   fibSpeedArcs,fibSpiral,fibCircles,fibTrendTime}.ts.
// The originating math is invinite's fib-* tools (commit
// 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite); re-licensed
// MIT for chartlang.

import type {
    FibChannelState,
    FibCirclesState,
    FibRetracementState,
    FibSpeedArcsState,
    FibSpeedFanState,
    FibSpiralState,
    FibTimeZoneState,
    FibTrendExtensionState,
    FibTrendTimeState,
    FibWedgeState,
} from "@invinite-org/chartlang-core";

import { sampleCubic } from "../_lib/bezier.js";
import { SOLID_DASH } from "../_lib/dash.js";
import { FIB_LEVELS, formatLevel } from "../_lib/fibLevels.js";
import { extendLineSegment } from "../_lib/lineExtend.js";
import { priceToY, timeToX, worldPointToPixel } from "../project.js";
import type { DrawPrimitive, Point2, Viewport } from "../types.js";

const DEFAULT_COLOR = "#facc15";
const DEFAULT_LINE_WIDTH = 1;
const LABEL_FONT = "12px sans-serif";
const LABEL_OFFSET_PX = 4;
const LABEL_TOP_PX = 12;
const LABEL_OFFSET_FRACTION = 0.25;
const TAU = Math.PI * 2;

/**
 * Build a level-line label `text` primitive. Shared by every fib
 * decomposer so the font / colour / alignment convention lives once.
 * Price- and radius-axis fibs use `baseline: "middle"`; time-axis fibs
 * pass `baseline: "top"`.
 */
function fibLabel(
    text: string,
    x: number,
    y: number,
    color: string,
    baseline: "middle" | "top",
): DrawPrimitive {
    return { kind: "text", x, y, text, color, font: LABEL_FONT, align: "left", baseline };
}

/**
 * Decompose a `fib-retracement` drawing — one horizontal level line per
 * Fibonacci ratio between `anchors[0].price` and `anchors[1].price`,
 * each honouring `style.extendLeft` / `style.extendRight` via
 * {@link extendLineSegment}. `style.levels` overrides {@link FIB_LEVELS};
 * `style.showLabels === true` appends a right-edge `formatLevel` label
 * per rail.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: FibRetracementState;
 *     declare const v: Viewport;
 *     const prims = decomposeFibRetracement(s, v);
 *     void prims;
 */
export function decomposeFibRetracement(
    state: FibRetracementState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const a = worldPointToPixel(state.anchors[0], view);
    const b = worldPointToPixel(state.anchors[1], view);
    const color = state.style.color ?? DEFAULT_COLOR;
    const levels = state.style.levels ?? FIB_LEVELS;
    const fromPrice = state.anchors[0].price;
    const toPrice = state.anchors[1].price;
    const out: DrawPrimitive[] = [];
    for (const level of levels) {
        const levelPrice = fromPrice + level * (toPrice - fromPrice);
        const levelY = priceToY(levelPrice, view);
        const { from, to } = extendLineSegment(
            { x: a.x, y: levelY },
            { x: b.x, y: levelY },
            { extendLeft: state.style.extendLeft, extendRight: state.style.extendRight },
            view,
        );
        out.push({
            kind: "polyline",
            points: [
                { x: from.x, y: levelY },
                { x: to.x, y: levelY },
            ],
            closed: false,
            stroke: { color, width: DEFAULT_LINE_WIDTH, dash: SOLID_DASH },
        });
        if (state.style.showLabels === true) {
            out.push(fibLabel(formatLevel(level), to.x + LABEL_OFFSET_PX, levelY, color, "middle"));
        }
    }
    return out;
}

/**
 * Decompose a `fib-trend-extension` drawing — projects fib-ratio
 * extensions from `anchors[2].price` using the A→B leg's price delta
 * (`anchors[1].price − anchors[0].price`). Each projected price is one
 * horizontal line from `timeToX(anchors[2].time)` rightward to the
 * viewport edge. `style.levels` overrides {@link FIB_LEVELS};
 * `showLabels` appends a label past the right edge.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: FibTrendExtensionState;
 *     declare const v: Viewport;
 *     const prims = decomposeFibTrendExtension(s, v);
 *     void prims;
 */
export function decomposeFibTrendExtension(
    state: FibTrendExtensionState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const [A, B, C] = state.anchors;
    const color = state.style.color ?? DEFAULT_COLOR;
    const levels = state.style.levels ?? FIB_LEVELS;
    const priceDelta = B.price - A.price;
    const startX = timeToX(C.time, view);
    const endX = view.pxWidth;
    const out: DrawPrimitive[] = [];
    for (const level of levels) {
        const levelPrice = C.price + level * priceDelta;
        const levelY = priceToY(levelPrice, view);
        out.push({
            kind: "polyline",
            points: [
                { x: startX, y: levelY },
                { x: endX, y: levelY },
            ],
            closed: false,
            stroke: { color, width: DEFAULT_LINE_WIDTH, dash: SOLID_DASH },
        });
        if (state.style.showLabels === true) {
            out.push(fibLabel(formatLevel(level), endX + LABEL_OFFSET_PX, levelY, color, "middle"));
        }
    }
    return out;
}

/**
 * Decompose a `fib-channel` drawing — one parallel rail per Fibonacci
 * ratio: each rail translates the primary `(anchors[0], anchors[1])`
 * line by `level · (anchors[2].y − anchors[0].y)` in pixel space.
 * `style.levels` overrides {@link FIB_LEVELS}; `showLabels` appends a
 * label at the rail's right endpoint.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: FibChannelState;
 *     declare const v: Viewport;
 *     const prims = decomposeFibChannel(s, v);
 *     void prims;
 */
export function decomposeFibChannel(
    state: FibChannelState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const a = worldPointToPixel(state.anchors[0], view);
    const b = worldPointToPixel(state.anchors[1], view);
    const c = worldPointToPixel(state.anchors[2], view);
    const color = state.style.color ?? DEFAULT_COLOR;
    const levels = state.style.levels ?? FIB_LEVELS;
    const offsetUnit = c.y - a.y;
    const out: DrawPrimitive[] = [];
    for (const level of levels) {
        const offsetY = level * offsetUnit;
        const fromY = a.y + offsetY;
        const toY = b.y + offsetY;
        out.push({
            kind: "polyline",
            points: [
                { x: a.x, y: fromY },
                { x: b.x, y: toY },
            ],
            closed: false,
            stroke: { color, width: DEFAULT_LINE_WIDTH, dash: SOLID_DASH },
        });
        if (state.style.showLabels === true) {
            out.push(fibLabel(formatLevel(level), b.x + LABEL_OFFSET_PX, toY, color, "middle"));
        }
    }
    return out;
}

/**
 * Decompose a `fib-time-zone` drawing — vertical lines at fib-ratio
 * spaced times `anchors[0].time + level · (anchors[1].time −
 * anchors[0].time)`, each spanning the full viewport height.
 * `style.levels` overrides {@link FIB_LEVELS}; `showLabels` appends a
 * top-anchored label.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: FibTimeZoneState;
 *     declare const v: Viewport;
 *     const prims = decomposeFibTimeZone(s, v);
 *     void prims;
 */
export function decomposeFibTimeZone(
    state: FibTimeZoneState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const [A, B] = state.anchors;
    const color = state.style.color ?? DEFAULT_COLOR;
    const levels = state.style.levels ?? FIB_LEVELS;
    const timeDelta = B.time - A.time;
    const out: DrawPrimitive[] = [];
    for (const level of levels) {
        const tx = timeToX(A.time + level * timeDelta, view);
        out.push({
            kind: "polyline",
            points: [
                { x: tx, y: 0 },
                { x: tx, y: view.pxHeight },
            ],
            closed: false,
            stroke: { color, width: DEFAULT_LINE_WIDTH, dash: SOLID_DASH },
        });
        if (state.style.showLabels === true) {
            out.push(
                fibLabel(formatLevel(level), tx + LABEL_OFFSET_PX, LABEL_TOP_PX, color, "top"),
            );
        }
    }
    return out;
}

/**
 * Decompose a `fib-trend-time` drawing — vertical lines at fib-spaced
 * times anchored at `anchors[2]`: `t = C.time + level · (B.time −
 * A.time)`. Mirrors `fib-time-zone` but uses the A→B leg as the
 * time-delta unit projected from C. `showLabels` appends a top label.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: FibTrendTimeState;
 *     declare const v: Viewport;
 *     const prims = decomposeFibTrendTime(s, v);
 *     void prims;
 */
export function decomposeFibTrendTime(
    state: FibTrendTimeState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const [A, B, C] = state.anchors;
    const color = state.style.color ?? DEFAULT_COLOR;
    const levels = state.style.levels ?? FIB_LEVELS;
    const timeDelta = B.time - A.time;
    const out: DrawPrimitive[] = [];
    for (const level of levels) {
        const tx = timeToX(C.time + level * timeDelta, view);
        out.push({
            kind: "polyline",
            points: [
                { x: tx, y: 0 },
                { x: tx, y: view.pxHeight },
            ],
            closed: false,
            stroke: { color, width: DEFAULT_LINE_WIDTH, dash: SOLID_DASH },
        });
        if (state.style.showLabels === true) {
            out.push(
                fibLabel(formatLevel(level), tx + LABEL_OFFSET_PX, LABEL_TOP_PX, color, "top"),
            );
        }
    }
    return out;
}

/**
 * Decompose a `fib-wedge` drawing — a fan of rays from `anchors[0]` (the
 * pivot) at fib-ratio-interpolated angles between the pivot→`anchors[1]`
 * and pivot→`anchors[2]` direction vectors. Ray length is
 * `max(pxWidth, pxHeight) · 2` so strokes always exit the viewport; a
 * degenerate (zero-magnitude) direction skips that level. `showLabels`
 * appends a label a quarter of the way along each ray.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: FibWedgeState;
 *     declare const v: Viewport;
 *     const prims = decomposeFibWedge(s, v);
 *     void prims;
 */
export function decomposeFibWedge(
    state: FibWedgeState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const pivot = worldPointToPixel(state.anchors[0], view);
    const r1 = worldPointToPixel(state.anchors[1], view);
    const r2 = worldPointToPixel(state.anchors[2], view);
    const color = state.style.color ?? DEFAULT_COLOR;
    const levels = state.style.levels ?? FIB_LEVELS;
    const d1x = r1.x - pivot.x;
    const d1y = r1.y - pivot.y;
    const d2x = r2.x - pivot.x;
    const d2y = r2.y - pivot.y;
    const rayLength = Math.max(view.pxWidth, view.pxHeight) * 2;
    const out: DrawPrimitive[] = [];
    for (const level of levels) {
        const dx = d1x + level * (d2x - d1x);
        const dy = d1y + level * (d2y - d1y);
        const mag = Math.hypot(dx, dy);
        if (mag === 0) continue;
        const ux = dx / mag;
        const uy = dy / mag;
        out.push({
            kind: "polyline",
            points: [pivot, { x: pivot.x + ux * rayLength, y: pivot.y + uy * rayLength }],
            closed: false,
            stroke: { color, width: DEFAULT_LINE_WIDTH, dash: SOLID_DASH },
        });
        if (state.style.showLabels === true) {
            out.push(
                fibLabel(
                    formatLevel(level),
                    pivot.x + ux * rayLength * LABEL_OFFSET_FRACTION,
                    pivot.y + uy * rayLength * LABEL_OFFSET_FRACTION,
                    color,
                    "middle",
                ),
            );
        }
    }
    return out;
}

/**
 * Decompose a `fib-speed-fan` drawing — a fan of rays from `anchors[0]`.
 * Each ray scales the A→B y-delta by a fib ratio while keeping the
 * x-delta constant. Ray length is `max(pxWidth, pxHeight) · 2`; a
 * degenerate direction skips that level. `showLabels` appends a label a
 * quarter of the way along each ray.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: FibSpeedFanState;
 *     declare const v: Viewport;
 *     const prims = decomposeFibSpeedFan(s, v);
 *     void prims;
 */
export function decomposeFibSpeedFan(
    state: FibSpeedFanState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const from = worldPointToPixel(state.anchors[0], view);
    const to = worldPointToPixel(state.anchors[1], view);
    const color = state.style.color ?? DEFAULT_COLOR;
    const levels = state.style.levels ?? FIB_LEVELS;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const rayLength = Math.max(view.pxWidth, view.pxHeight) * 2;
    const out: DrawPrimitive[] = [];
    for (const level of levels) {
        const rdy = level * dy;
        const mag = Math.hypot(dx, rdy);
        if (mag === 0) continue;
        const ux = dx / mag;
        const uy = rdy / mag;
        out.push({
            kind: "polyline",
            points: [from, { x: from.x + ux * rayLength, y: from.y + uy * rayLength }],
            closed: false,
            stroke: { color, width: DEFAULT_LINE_WIDTH, dash: SOLID_DASH },
        });
        if (state.style.showLabels === true) {
            out.push(
                fibLabel(
                    formatLevel(level),
                    from.x + ux * rayLength * LABEL_OFFSET_FRACTION,
                    from.y + uy * rayLength * LABEL_OFFSET_FRACTION,
                    color,
                    "middle",
                ),
            );
        }
    }
    return out;
}

/**
 * Decompose a `fib-speed-arcs` drawing — concentric full circles centred
 * at `anchors[0]` with radii `level · R₀`, `R₀ = |anchors[1] −
 * anchors[0]|` in pixel space. Always-full-circle (half-disk variant
 * deferred). `showLabels` appends a label to the right of each arc.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: FibSpeedArcsState;
 *     declare const v: Viewport;
 *     const prims = decomposeFibSpeedArcs(s, v);
 *     void prims;
 */
export function decomposeFibSpeedArcs(
    state: FibSpeedArcsState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const centre = worldPointToPixel(state.anchors[0], view);
    const edge = worldPointToPixel(state.anchors[1], view);
    const color = state.style.color ?? DEFAULT_COLOR;
    const levels = state.style.levels ?? FIB_LEVELS;
    const r0 = Math.hypot(edge.x - centre.x, edge.y - centre.y);
    return concentricArcs(centre, r0, levels, color, state.style.showLabels === true);
}

/**
 * Decompose a `fib-circles` drawing — concentric full circles centred at
 * `anchors[0]` with radii `level · R₀`, `R₀ = |anchors[1] − anchors[0]|`
 * (the radius-point distance) in pixel space. Uses fib ratios (not the
 * integer Fibonacci sequence). `showLabels` appends a label to the right
 * of each circle.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: FibCirclesState;
 *     declare const v: Viewport;
 *     const prims = decomposeFibCircles(s, v);
 *     void prims;
 */
export function decomposeFibCircles(
    state: FibCirclesState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const centre = worldPointToPixel(state.anchors[0], view);
    const radiusPoint = worldPointToPixel(state.anchors[1], view);
    const color = state.style.color ?? DEFAULT_COLOR;
    const levels = state.style.levels ?? FIB_LEVELS;
    const r0 = Math.hypot(radiusPoint.x - centre.x, radiusPoint.y - centre.y);
    return concentricArcs(centre, r0, levels, color, state.style.showLabels === true);
}

/**
 * Shared concentric-arc builder for `fib-speed-arcs` / `fib-circles`:
 * one full `arc` primitive per level at radius `level · r0`, plus an
 * optional right-edge label. Matches the canvas2d source, which emits a
 * (possibly zero-radius) arc per level without an early return.
 */
function concentricArcs(
    centre: Point2,
    r0: number,
    levels: ReadonlyArray<number>,
    color: string,
    showLabels: boolean,
): ReadonlyArray<DrawPrimitive> {
    const out: DrawPrimitive[] = [];
    for (const level of levels) {
        const radius = level * r0;
        out.push({
            kind: "arc",
            cx: centre.x,
            cy: centre.y,
            r: radius,
            start: 0,
            end: TAU,
            closed: false,
            stroke: { color, width: DEFAULT_LINE_WIDTH, dash: SOLID_DASH },
        });
        if (showLabels) {
            out.push(
                fibLabel(
                    formatLevel(level),
                    centre.x + radius + LABEL_OFFSET_PX,
                    centre.y,
                    color,
                    "middle",
                ),
            );
        }
    }
    return out;
}

// Number of quarter-turns sampled = 8 → 2 full rotations.
const SPIRAL_QUARTERS = 8;
// Samples per quarter for the cubic Bezier approximation.
const SPIRAL_SAMPLES_PER_QUARTER = 16;
// φ ≈ 1.618. Each quarter scales the spiral radius by 1/φ inward.
const PHI = (1 + Math.sqrt(5)) / 2;
// Classical Bezier-arc factor for a 90° quadrant: k = 4(√2 − 1)/3.
const SPIRAL_K = (4 * (Math.sqrt(2) - 1)) / 3;

/**
 * Decompose a `fib-spiral` drawing — a chained cubic-Bezier
 * approximation of a golden spiral as one open polyline. Each
 * quarter-turn is one cubic Bezier with the classical `k ≈ 0.5523` arc
 * factor; the radius shrinks by `1/φ` per quarter. Centre =
 * `anchors[0]`; initial radius `|anchors[1] − anchors[0]|` in pixel
 * space. A zero initial radius returns `[]` (matching the source's
 * `if (r === 0) return`).
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: FibSpiralState;
 *     declare const v: Viewport;
 *     const prims = decomposeFibSpiral(s, v);
 *     void prims;
 */
export function decomposeFibSpiral(
    state: FibSpiralState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const centre = worldPointToPixel(state.anchors[0], view);
    const edge = worldPointToPixel(state.anchors[1], view);
    const color = state.style.color ?? DEFAULT_COLOR;
    let r = Math.hypot(edge.x - centre.x, edge.y - centre.y);
    if (r === 0) return [];
    const points: Point2[] = [{ x: centre.x + r, y: centre.y }];
    for (let q = 0; q < SPIRAL_QUARTERS; q++) {
        const baseAngle = q * (Math.PI / 2);
        const r1 = r;
        const r2 = r / PHI;
        const cos0 = Math.cos(baseAngle);
        const sin0 = Math.sin(baseAngle);
        const cos1 = Math.cos(baseAngle + Math.PI / 2);
        const sin1 = Math.sin(baseAngle + Math.PI / 2);
        const p0: Point2 = { x: centre.x + r1 * cos0, y: centre.y + r1 * sin0 };
        const p3: Point2 = { x: centre.x + r2 * cos1, y: centre.y + r2 * sin1 };
        const p1: Point2 = { x: p0.x + SPIRAL_K * r1 * cos1, y: p0.y + SPIRAL_K * r1 * sin1 };
        const p2: Point2 = { x: p3.x + SPIRAL_K * r2 * cos0, y: p3.y + SPIRAL_K * r2 * sin0 };
        const samples = sampleCubic(p0, p1, p2, p3, SPIRAL_SAMPLES_PER_QUARTER);
        // Skip the first sample (the previous quarter's endpoint / the
        // initial start point) to avoid a duplicate vertex.
        for (let i = 1; i < samples.length; i++) points.push(samples[i]);
        r = r2;
    }
    return [
        {
            kind: "polyline",
            points,
            closed: false,
            stroke: { color, width: DEFAULT_LINE_WIDTH, dash: SOLID_DASH },
        },
    ];
}
