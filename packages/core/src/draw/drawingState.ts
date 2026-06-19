// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Color, JsonValue, Price, Time } from "../types.js";
import type {
    ArrowMarkerOpts,
    ArrowOpts,
    BrushStyle,
    FibOpts,
    FillBetweenStyle,
    FrameOpts,
    HighlighterStyle,
    LineDrawStyle,
    PathOpts,
    RegressionTrendOpts,
    ShapeStyle,
    TextOpts,
} from "./drawingStyle.js";
import type { TableCell, TablePosition } from "./table.js";
import type {
    AnchorHept,
    AnchorPair,
    AnchorQuad,
    AnchorQuint,
    AnchorTriple,
    WorldPoint,
} from "./worldPoint.js";

/**
 * Script-mutable metadata fields every {@link DrawingState} variant
 * carries. `name` surfaces in the editor layer; `visible: false` hides
 * the drawing without removing it.
 *
 * @formula  N/A — metadata only, no geometry
 * @anchors  N/A — script-author metadata
 * @since 0.3
 * @stable
 * @example
 *     const m: DrawingMeta = { name: "Support", visible: true };
 *     void m;
 */
export type DrawingMeta = {
    readonly name?: string;
    readonly visible?: boolean;
};

/**
 * `line` — two-anchor straight line. Carries `extendLeft` /
 * `extendRight` flags so the invinite `ray` / `extended-line` tools
 * collapse into this single kind.
 *
 * @formula  identity — segment between `anchors[0]` and `anchors[1]`
 * @anchors  anchors: [from, to]
 * @since 0.3
 * @stable
 * @example
 *     const s: LineState = {
 *         kind: "line",
 *         anchors: [{ time: 1, price: 1 }, { time: 2, price: 2 }],
 *         style: {},
 *     };
 *     void s;
 */
export type LineState = DrawingMeta & {
    readonly kind: "line";
    readonly anchors: AnchorPair;
    readonly style: LineDrawStyle;
};

/**
 * `horizontal-line` — single-price line extending across the chart.
 *
 * @formula  identity — horizontal line at `price`
 * @anchors  price
 * @since 0.3
 * @stable
 * @example
 *     const s: HorizontalLineState = {
 *         kind: "horizontal-line",
 *         price: 100,
 *         style: { color: "#3b82f6" },
 *     };
 *     void s;
 */
export type HorizontalLineState = DrawingMeta & {
    readonly kind: "horizontal-line";
    readonly price: Price;
    readonly style: LineDrawStyle;
};

/**
 * `horizontal-ray` — single-price ray anchored at a starting time.
 *
 * @formula  identity — ray from `anchor` extending right at constant price
 * @anchors  anchor
 * @since 0.3
 * @stable
 * @example
 *     const s: HorizontalRayState = {
 *         kind: "horizontal-ray",
 *         anchor: { time: 1, price: 100 },
 *         style: {},
 *     };
 *     void s;
 */
export type HorizontalRayState = DrawingMeta & {
    readonly kind: "horizontal-ray";
    readonly anchor: WorldPoint;
    readonly style: LineDrawStyle;
};

/**
 * `vertical-line` — single-time line extending across the price axis.
 *
 * @formula  identity — vertical line at `time`
 * @anchors  time
 * @since 0.3
 * @stable
 * @example
 *     const s: VerticalLineState = {
 *         kind: "vertical-line",
 *         time: 1_700_000_000_000,
 *         style: {},
 *     };
 *     void s;
 */
export type VerticalLineState = DrawingMeta & {
    readonly kind: "vertical-line";
    readonly time: Time;
    readonly style: LineDrawStyle;
};

/**
 * `cross-line` — orthogonal horizontal + vertical pair through one anchor.
 *
 * @formula  identity — crosshair through `anchor`
 * @anchors  anchor
 * @since 0.3
 * @stable
 * @example
 *     const s: CrossLineState = {
 *         kind: "cross-line",
 *         anchor: { time: 1, price: 1 },
 *         style: {},
 *     };
 *     void s;
 */
export type CrossLineState = DrawingMeta & {
    readonly kind: "cross-line";
    readonly anchor: WorldPoint;
    readonly style: LineDrawStyle;
};

/**
 * `trend-angle` — line with an angle annotation read off the two anchors.
 *
 * @formula  angle = atan2(Δprice, Δtime)
 * @anchors  anchors: [from, to]
 * @since 0.3
 * @stable
 * @example
 *     const s: TrendAngleState = {
 *         kind: "trend-angle",
 *         anchors: [{ time: 0, price: 0 }, { time: 1, price: 1 }],
 *         style: {},
 *     };
 *     void s;
 */
export type TrendAngleState = DrawingMeta & {
    readonly kind: "trend-angle";
    readonly anchors: AnchorPair;
    readonly style: LineDrawStyle;
};

/**
 * `rectangle` — axis-aligned filled rectangle defined by two corners.
 *
 * @formula  identity — axis-aligned bounding box of `anchors`
 * @anchors  anchors: [topLeft, bottomRight] (or any opposite-corner pair)
 * @since 0.3
 * @stable
 * @example
 *     const s: RectangleState = {
 *         kind: "rectangle",
 *         anchors: [{ time: 0, price: 0 }, { time: 1, price: 1 }],
 *         style: {},
 *     };
 *     void s;
 */
export type RectangleState = DrawingMeta & {
    readonly kind: "rectangle";
    readonly anchors: AnchorPair;
    readonly style: ShapeStyle;
};

/**
 * `rotated-rectangle` — four-corner rectangle, supports arbitrary rotation.
 *
 * @formula  identity — polygon through the four anchor corners
 * @anchors  anchors: [c1, c2, c3, c4] (CW or CCW)
 * @since 0.3
 * @stable
 * @example
 *     const s: RotatedRectangleState = {
 *         kind: "rotated-rectangle",
 *         anchors: [
 *             { time: 0, price: 0 }, { time: 1, price: 1 },
 *             { time: 2, price: 0 }, { time: 1, price: -1 },
 *         ],
 *         style: {},
 *     };
 *     void s;
 */
export type RotatedRectangleState = DrawingMeta & {
    readonly kind: "rotated-rectangle";
    readonly anchors: AnchorQuad;
    readonly style: ShapeStyle;
};

/**
 * `triangle` — three-vertex polygon.
 *
 * @formula  identity — closed polygon through the three anchors
 * @anchors  anchors: [v1, v2, v3]
 * @since 0.3
 * @stable
 * @example
 *     const s: TriangleState = {
 *         kind: "triangle",
 *         anchors: [
 *             { time: 0, price: 0 },
 *             { time: 1, price: 1 },
 *             { time: 2, price: 0 },
 *         ],
 *         style: {},
 *     };
 *     void s;
 */
export type TriangleState = DrawingMeta & {
    readonly kind: "triangle";
    readonly anchors: AnchorTriple;
    readonly style: ShapeStyle;
};

/**
 * `polyline` — open polyline of N anchors.
 *
 * @formula  identity — N-anchor open polyline
 * @anchors  anchors: ReadonlyArray<WorldPoint>
 * @since 0.3
 * @stable
 * @example
 *     const s: PolylineState = {
 *         kind: "polyline",
 *         anchors: [{ time: 0, price: 0 }, { time: 1, price: 1 }],
 *         style: {},
 *     };
 *     void s;
 */
export type PolylineState = DrawingMeta & {
    readonly kind: "polyline";
    readonly anchors: ReadonlyArray<WorldPoint>;
    readonly style: LineDrawStyle;
};

/**
 * `circle` — defined by centre + a radius anchor.
 *
 * @formula  r = distance(anchors[0], anchors[1])
 * @anchors  anchors: [centre, radiusPoint]
 * @since 0.3
 * @stable
 * @example
 *     const s: CircleState = {
 *         kind: "circle",
 *         anchors: [{ time: 0, price: 0 }, { time: 1, price: 0 }],
 *         style: {},
 *     };
 *     void s;
 */
export type CircleState = DrawingMeta & {
    readonly kind: "circle";
    readonly anchors: AnchorPair;
    readonly style: ShapeStyle;
};

/**
 * `ellipse` — bounding-box anchor pair.
 *
 * @formula  ellipse inscribed in the bounding box of `anchors`
 * @anchors  anchors: [bboxA, bboxB]
 * @since 0.3
 * @stable
 * @example
 *     const s: EllipseState = {
 *         kind: "ellipse",
 *         anchors: [{ time: 0, price: 0 }, { time: 2, price: 1 }],
 *         style: {},
 *     };
 *     void s;
 */
export type EllipseState = DrawingMeta & {
    readonly kind: "ellipse";
    readonly anchors: AnchorPair;
    readonly style: ShapeStyle;
};

/**
 * `path` — open or closed polyline with arbitrary anchor count.
 *
 * @formula  identity — N-anchor path (closed = `style.closed`)
 * @anchors  anchors: ReadonlyArray<WorldPoint>
 * @since 0.3
 * @stable
 * @example
 *     const s: PathState = {
 *         kind: "path",
 *         anchors: [{ time: 0, price: 0 }, { time: 1, price: 1 }],
 *         style: { closed: true },
 *     };
 *     void s;
 */
export type PathState = DrawingMeta & {
    readonly kind: "path";
    readonly anchors: ReadonlyArray<WorldPoint>;
    readonly style: PathOpts;
};

/**
 * State for a `fill-between` drawing: a filled ribbon between two edges.
 * Each edge is an ordered list of world anchors; the rendered region is
 * the closed polygon `edgeA` forward then `edgeB` reversed.
 *
 * @formula N/A — drawing state payload
 * @anchors `edgeA`, `edgeB` — two `ReadonlyArray<WorldPoint>`
 * @since 0.4
 * @stable
 * @example
 *     const state: FillBetweenState = {
 *         kind: "fill-between",
 *         edgeA: [{ time: 0, price: 1 }],
 *         edgeB: [{ time: 0, price: 0 }],
 *         style: { fill: "#3b82f6" },
 *     };
 *     void state;
 */
export type FillBetweenState = DrawingMeta & {
    readonly kind: "fill-between";
    readonly edgeA: ReadonlyArray<WorldPoint>;
    readonly edgeB: ReadonlyArray<WorldPoint>;
    readonly style: FillBetweenStyle;
};

/**
 * `marker` — single-anchor glyph with optional value label.
 *
 * @formula  identity — marker placed at `anchor`
 * @anchors  anchor
 * @since 0.3
 * @stable
 * @example
 *     const s: MarkerState = {
 *         kind: "marker",
 *         anchor: { time: 1, price: 1 },
 *         text: "B",
 *         style: {},
 *     };
 *     void s;
 */
export type MarkerState = DrawingMeta & {
    readonly kind: "marker";
    readonly anchor: WorldPoint;
    readonly text?: string;
    readonly value?: number;
    readonly style: TextOpts;
};

/**
 * `arc` — three-anchor arc (start / control / end).
 *
 * @formula  quadratic Bezier through `anchors`
 * @anchors  anchors: [start, control, end]
 * @since 0.3
 * @stable
 * @example
 *     const s: ArcState = {
 *         kind: "arc",
 *         anchors: [
 *             { time: 0, price: 0 },
 *             { time: 1, price: 2 },
 *             { time: 2, price: 0 },
 *         ],
 *         style: {},
 *     };
 *     void s;
 */
export type ArcState = DrawingMeta & {
    readonly kind: "arc";
    readonly anchors: AnchorTriple;
    readonly style: LineDrawStyle;
};

/**
 * `curve` — three-anchor quadratic Bezier.
 *
 * @formula  B(t) = (1−t)²·P0 + 2(1−t)t·P1 + t²·P2
 * @anchors  anchors: [P0, P1, P2]
 * @since 0.3
 * @stable
 * @example
 *     const s: CurveState = {
 *         kind: "curve",
 *         anchors: [
 *             { time: 0, price: 0 },
 *             { time: 1, price: 2 },
 *             { time: 2, price: 0 },
 *         ],
 *         style: {},
 *     };
 *     void s;
 */
export type CurveState = DrawingMeta & {
    readonly kind: "curve";
    readonly anchors: AnchorTriple;
    readonly style: LineDrawStyle;
};

/**
 * `double-curve` — five-anchor cubic Bezier pair (two stitched curves).
 *
 * @formula  two cubic Beziers stitched at `anchors[2]`
 * @anchors  anchors: [P0, P1, mid, P3, P4]
 * @since 0.3
 * @stable
 * @example
 *     const s: DoubleCurveState = {
 *         kind: "double-curve",
 *         anchors: [
 *             { time: 0, price: 0 }, { time: 1, price: 1 },
 *             { time: 2, price: 0 }, { time: 3, price: -1 },
 *             { time: 4, price: 0 },
 *         ],
 *         style: {},
 *     };
 *     void s;
 */
export type DoubleCurveState = DrawingMeta & {
    readonly kind: "double-curve";
    readonly anchors: AnchorQuint;
    readonly style: LineDrawStyle;
};

/**
 * `pen` — freehand polyline.
 *
 * @formula  identity — sampled freehand polyline
 * @anchors  anchors: ReadonlyArray<WorldPoint>
 * @since 0.3
 * @stable
 * @example
 *     const s: PenState = {
 *         kind: "pen",
 *         anchors: [{ time: 0, price: 0 }, { time: 1, price: 1 }],
 *         style: {},
 *     };
 *     void s;
 */
export type PenState = DrawingMeta & {
    readonly kind: "pen";
    readonly anchors: ReadonlyArray<WorldPoint>;
    readonly style: LineDrawStyle;
};

/**
 * `highlighter` — freehand thick translucent stroke.
 *
 * @formula  identity — sampled freehand polyline rendered translucent
 * @anchors  anchors: ReadonlyArray<WorldPoint>
 * @since 0.3
 * @stable
 * @example
 *     const s: HighlighterState = {
 *         kind: "highlighter",
 *         anchors: [{ time: 0, price: 0 }, { time: 1, price: 1 }],
 *         style: { color: "#facc15", alpha: 0.3 },
 *     };
 *     void s;
 */
export type HighlighterState = DrawingMeta & {
    readonly kind: "highlighter";
    readonly anchors: ReadonlyArray<WorldPoint>;
    readonly style: HighlighterStyle;
};

/**
 * `brush` — freehand stroked-and-filled stroke.
 *
 * @formula  identity — sampled freehand polyline rendered stroked + filled
 * @anchors  anchors: ReadonlyArray<WorldPoint>
 * @since 0.3
 * @stable
 * @example
 *     const s: BrushState = {
 *         kind: "brush",
 *         anchors: [{ time: 0, price: 0 }, { time: 1, price: 1 }],
 *         style: { stroke: "#000", fill: "#fff" },
 *     };
 *     void s;
 */
export type BrushState = DrawingMeta & {
    readonly kind: "brush";
    readonly anchors: ReadonlyArray<WorldPoint>;
    readonly style: BrushStyle;
};

/**
 * `text` — single-anchor text label.
 *
 * @formula  identity — `body` rendered at `anchor`
 * @anchors  anchor
 * @since 0.3
 * @stable
 * @example
 *     const s: TextState = {
 *         kind: "text",
 *         anchor: { time: 1, price: 1 },
 *         body: "Note",
 *         style: {},
 *     };
 *     void s;
 */
export type TextState = DrawingMeta & {
    readonly kind: "text";
    readonly anchor: WorldPoint;
    readonly body: string;
    readonly style: TextOpts;
};

/**
 * `arrow` — two-anchor arrow with optional label.
 *
 * @formula  identity — directional arrow from `anchors[0]` → `anchors[1]`
 * @anchors  anchors: [tail, head]
 * @since 0.3
 * @stable
 * @example
 *     const s: ArrowState = {
 *         kind: "arrow",
 *         anchors: [{ time: 0, price: 0 }, { time: 1, price: 1 }],
 *         style: {},
 *     };
 *     void s;
 */
export type ArrowState = DrawingMeta & {
    readonly kind: "arrow";
    readonly anchors: AnchorPair;
    readonly style: ArrowOpts;
};

/**
 * `arrow-marker` — single-anchor compact arrow + label glyph.
 *
 * @formula  identity — arrow glyph at `anchor` with optional text
 * @anchors  anchor
 * @since 0.3
 * @stable
 * @example
 *     const s: ArrowMarkerState = {
 *         kind: "arrow-marker",
 *         anchor: { time: 1, price: 1 },
 *         style: { text: "B" },
 *     };
 *     void s;
 */
export type ArrowMarkerState = DrawingMeta & {
    readonly kind: "arrow-marker";
    readonly anchor: WorldPoint;
    readonly style: ArrowMarkerOpts;
};

/**
 * `arrow-mark-up` — bullish marker (typically below the bar).
 *
 * @formula  identity — upward marker glyph at `anchor`
 * @anchors  anchor
 * @since 0.3
 * @stable
 * @example
 *     const s: ArrowMarkUpState = {
 *         kind: "arrow-mark-up",
 *         anchor: { time: 1, price: 1 },
 *         style: {},
 *     };
 *     void s;
 */
export type ArrowMarkUpState = DrawingMeta & {
    readonly kind: "arrow-mark-up";
    readonly anchor: WorldPoint;
    readonly style: ArrowMarkerOpts;
};

/**
 * `arrow-mark-down` — bearish marker (typically above the bar).
 *
 * @formula  identity — downward marker glyph at `anchor`
 * @anchors  anchor
 * @since 0.3
 * @stable
 * @example
 *     const s: ArrowMarkDownState = {
 *         kind: "arrow-mark-down",
 *         anchor: { time: 1, price: 1 },
 *         style: {},
 *     };
 *     void s;
 */
export type ArrowMarkDownState = DrawingMeta & {
    readonly kind: "arrow-mark-down";
    readonly anchor: WorldPoint;
    readonly style: ArrowMarkerOpts;
};

/**
 * `trend-channel` — two parallel lines defined by three anchors.
 *
 * @formula  parallel pair: line(`anchors[0]`, `anchors[1]`) and its
 *           translate through `anchors[2]`
 * @anchors  anchors: [primaryA, primaryB, parallelHook]
 * @since 0.3
 * @stable
 * @example
 *     const s: TrendChannelState = {
 *         kind: "trend-channel",
 *         anchors: [
 *             { time: 0, price: 0 },
 *             { time: 1, price: 1 },
 *             { time: 0, price: 1 },
 *         ],
 *         style: {},
 *     };
 *     void s;
 */
export type TrendChannelState = DrawingMeta & {
    readonly kind: "trend-channel";
    readonly anchors: AnchorTriple;
    readonly style: LineDrawStyle;
};

/**
 * `flat-top-bottom` — horizontal channel of two parallel flat edges.
 *
 * @formula  two horizontal lines at min/max prices from anchors
 * @anchors  anchors: [leftEdge, rightEdge, oppositeHook]
 * @since 0.3
 * @stable
 * @example
 *     const s: FlatTopBottomState = {
 *         kind: "flat-top-bottom",
 *         anchors: [
 *             { time: 0, price: 1 },
 *             { time: 1, price: 1 },
 *             { time: 0, price: 0 },
 *         ],
 *         style: {},
 *     };
 *     void s;
 */
export type FlatTopBottomState = DrawingMeta & {
    readonly kind: "flat-top-bottom";
    readonly anchors: AnchorTriple;
    readonly style: LineDrawStyle;
};

/**
 * `disjoint-channel` — two non-parallel channel edges.
 *
 * @formula  two independent line segments — line(A,B) + line(C,D)
 * @anchors  anchors: [A, B, C, D]
 * @since 0.3
 * @stable
 * @example
 *     const s: DisjointChannelState = {
 *         kind: "disjoint-channel",
 *         anchors: [
 *             { time: 0, price: 0 }, { time: 1, price: 1 },
 *             { time: 0, price: 2 }, { time: 1, price: 3 },
 *         ],
 *         style: {},
 *     };
 *     void s;
 */
export type DisjointChannelState = DrawingMeta & {
    readonly kind: "disjoint-channel";
    readonly anchors: AnchorQuad;
    readonly style: LineDrawStyle;
};

/**
 * `regression-trend` — least-squares fit ± bands across an anchor range.
 *
 * @formula  fit = OLS(close[start..end]); bands = fit ± σ·stdevMultiplier
 * @anchors  anchors: [start, end]
 * @since 0.3
 * @stable
 * @example
 *     const s: RegressionTrendState = {
 *         kind: "regression-trend",
 *         anchors: [{ time: 0, price: 0 }, { time: 100, price: 1 }],
 *         style: { source: "close", stdevMultiplier: 2 },
 *     };
 *     void s;
 */
export type RegressionTrendState = DrawingMeta & {
    readonly kind: "regression-trend";
    readonly anchors: AnchorPair;
    readonly style: RegressionTrendOpts;
};

/**
 * `fib-retracement` — fib level lines between two pivot anchors.
 *
 * @formula  for each level r in `style.levels`: y(r) = A.price + r·(B.price − A.price)
 * @anchors  anchors: [swingA, swingB]
 * @since 0.3
 * @stable
 * @example
 *     const s: FibRetracementState = {
 *         kind: "fib-retracement",
 *         anchors: [{ time: 0, price: 0 }, { time: 1, price: 1 }],
 *         style: { levels: [0.382, 0.5, 0.618] },
 *     };
 *     void s;
 */
export type FibRetracementState = DrawingMeta & {
    readonly kind: "fib-retracement";
    readonly anchors: AnchorPair;
    readonly style: FibOpts;
};

/**
 * `fib-trend-extension` — three-anchor fib extension projection.
 *
 * @formula  range r = B−A; projection = C + r·level for level in style.levels
 * @anchors  anchors: [A, B, C]
 * @since 0.3
 * @stable
 * @example
 *     const s: FibTrendExtensionState = {
 *         kind: "fib-trend-extension",
 *         anchors: [
 *             { time: 0, price: 0 },
 *             { time: 1, price: 1 },
 *             { time: 2, price: 0.5 },
 *         ],
 *         style: {},
 *     };
 *     void s;
 */
export type FibTrendExtensionState = DrawingMeta & {
    readonly kind: "fib-trend-extension";
    readonly anchors: AnchorTriple;
    readonly style: FibOpts;
};

/**
 * `fib-channel` — fib levels projected as parallel channel lines.
 *
 * @formula  parallel translates of line(A,B) at fib-ratio offsets through C
 * @anchors  anchors: [A, B, C]
 * @since 0.3
 * @stable
 * @example
 *     const s: FibChannelState = {
 *         kind: "fib-channel",
 *         anchors: [
 *             { time: 0, price: 0 },
 *             { time: 1, price: 1 },
 *             { time: 0, price: 1 },
 *         ],
 *         style: {},
 *     };
 *     void s;
 */
export type FibChannelState = DrawingMeta & {
    readonly kind: "fib-channel";
    readonly anchors: AnchorTriple;
    readonly style: FibOpts;
};

/**
 * `fib-time-zone` — vertical fib zones along the time axis.
 *
 * @formula  vertical lines at t = A.time + ratio·(B.time − A.time)
 * @anchors  anchors: [A, B]
 * @since 0.3
 * @stable
 * @example
 *     const s: FibTimeZoneState = {
 *         kind: "fib-time-zone",
 *         anchors: [{ time: 0, price: 0 }, { time: 100, price: 0 }],
 *         style: {},
 *     };
 *     void s;
 */
export type FibTimeZoneState = DrawingMeta & {
    readonly kind: "fib-time-zone";
    readonly anchors: AnchorPair;
    readonly style: FibOpts;
};

/**
 * `fib-wedge` — fib-spaced lines fanned from a single anchor.
 *
 * @formula  rays from `anchors[0]` at angles derived from fib ratios
 * @anchors  anchors: [pivot, range1, range2]
 * @since 0.3
 * @stable
 * @example
 *     const s: FibWedgeState = {
 *         kind: "fib-wedge",
 *         anchors: [
 *             { time: 0, price: 0 },
 *             { time: 1, price: 1 },
 *             { time: 1, price: -1 },
 *         ],
 *         style: {},
 *     };
 *     void s;
 */
export type FibWedgeState = DrawingMeta & {
    readonly kind: "fib-wedge";
    readonly anchors: AnchorTriple;
    readonly style: FibOpts;
};

/**
 * `fib-speed-fan` — fan of fib-ratio speed lines from a pivot.
 *
 * @formula  rays from A with slopes = fib-ratio · slope(line(A,B))
 * @anchors  anchors: [A, B]
 * @since 0.3
 * @stable
 * @example
 *     const s: FibSpeedFanState = {
 *         kind: "fib-speed-fan",
 *         anchors: [{ time: 0, price: 0 }, { time: 1, price: 1 }],
 *         style: {},
 *     };
 *     void s;
 */
export type FibSpeedFanState = DrawingMeta & {
    readonly kind: "fib-speed-fan";
    readonly anchors: AnchorPair;
    readonly style: FibOpts;
};

/**
 * `fib-speed-arcs` — concentric arcs at fib radii.
 *
 * @formula  for each level r in `style.levels`: arc of radius r·|AB| centred at A
 * @anchors  anchors: [centre, edge]
 * @since 0.3
 * @stable
 * @example
 *     const s: FibSpeedArcsState = {
 *         kind: "fib-speed-arcs",
 *         anchors: [{ time: 0, price: 0 }, { time: 1, price: 0 }],
 *         style: {},
 *     };
 *     void s;
 */
export type FibSpeedArcsState = DrawingMeta & {
    readonly kind: "fib-speed-arcs";
    readonly anchors: AnchorPair;
    readonly style: FibOpts;
};

/**
 * `fib-spiral` — fib-ratio logarithmic spiral.
 *
 * @formula  r(θ) = a · φ^(θ/π/2) where φ = (1+√5)/2
 * @anchors  anchors: [centre, edge]
 * @since 0.3
 * @stable
 * @example
 *     const s: FibSpiralState = {
 *         kind: "fib-spiral",
 *         anchors: [{ time: 0, price: 0 }, { time: 1, price: 0 }],
 *         style: {},
 *     };
 *     void s;
 */
export type FibSpiralState = DrawingMeta & {
    readonly kind: "fib-spiral";
    readonly anchors: AnchorPair;
    readonly style: FibOpts;
};

/**
 * `fib-circles` — concentric circles at fib radii.
 *
 * @formula  for each level r in `style.levels`: circle of radius r·|AB| centred at A
 * @anchors  anchors: [centre, edge]
 * @since 0.3
 * @stable
 * @example
 *     const s: FibCirclesState = {
 *         kind: "fib-circles",
 *         anchors: [{ time: 0, price: 0 }, { time: 1, price: 0 }],
 *         style: {},
 *     };
 *     void s;
 */
export type FibCirclesState = DrawingMeta & {
    readonly kind: "fib-circles";
    readonly anchors: AnchorPair;
    readonly style: FibOpts;
};

/**
 * `fib-trend-time` — fib-spaced vertical time projections from a swing.
 *
 * @formula  vertical lines at t = C.time + ratio·(B.time − A.time)
 * @anchors  anchors: [A, B, C]
 * @since 0.3
 * @stable
 * @example
 *     const s: FibTrendTimeState = {
 *         kind: "fib-trend-time",
 *         anchors: [
 *             { time: 0, price: 0 },
 *             { time: 1, price: 1 },
 *             { time: 2, price: 0.5 },
 *         ],
 *         style: {},
 *     };
 *     void s;
 */
export type FibTrendTimeState = DrawingMeta & {
    readonly kind: "fib-trend-time";
    readonly anchors: AnchorTriple;
    readonly style: FibOpts;
};

/**
 * `gann-box` — gann ratio grid inside an anchor pair.
 *
 * @formula  grid of horizontal + vertical lines at 1/8, 2/8, …, 7/8 of |AB|
 * @anchors  anchors: [A, B]
 * @since 0.3
 * @stable
 * @example
 *     const s: GannBoxState = {
 *         kind: "gann-box",
 *         anchors: [{ time: 0, price: 0 }, { time: 1, price: 1 }],
 *         style: {},
 *     };
 *     void s;
 */
export type GannBoxState = DrawingMeta & {
    readonly kind: "gann-box";
    readonly anchors: AnchorPair;
    readonly style: LineDrawStyle;
};

/**
 * `gann-square-fixed` — square-of-nine fixed-size grid at an anchor.
 *
 * @formula  9×9 grid centred at `anchor` with fixed step
 * @anchors  anchor
 * @since 0.3
 * @stable
 * @example
 *     const s: GannSquareFixedState = {
 *         kind: "gann-square-fixed",
 *         anchor: { time: 0, price: 0 },
 *         style: {},
 *     };
 *     void s;
 */
export type GannSquareFixedState = DrawingMeta & {
    readonly kind: "gann-square-fixed";
    readonly anchor: WorldPoint;
    readonly style: LineDrawStyle;
};

/**
 * `gann-square` — square-of-nine sized by two anchors.
 *
 * @formula  9×9 grid spanning bbox of `anchors`
 * @anchors  anchors: [A, B]
 * @since 0.3
 * @stable
 * @example
 *     const s: GannSquareState = {
 *         kind: "gann-square",
 *         anchors: [{ time: 0, price: 0 }, { time: 1, price: 1 }],
 *         style: {},
 *     };
 *     void s;
 */
export type GannSquareState = DrawingMeta & {
    readonly kind: "gann-square";
    readonly anchors: AnchorPair;
    readonly style: LineDrawStyle;
};

/**
 * `gann-fan` — fan of gann-angle lines from a pivot.
 *
 * @formula  rays from A at slopes 1×1, 1×2, 2×1, 1×3, 3×1, 1×4, 4×1, 1×8, 8×1
 * @anchors  anchors: [pivot, reference]
 * @since 0.3
 * @stable
 * @example
 *     const s: GannFanState = {
 *         kind: "gann-fan",
 *         anchors: [{ time: 0, price: 0 }, { time: 1, price: 1 }],
 *         style: {},
 *     };
 *     void s;
 */
export type GannFanState = DrawingMeta & {
    readonly kind: "gann-fan";
    readonly anchors: AnchorPair;
    readonly style: LineDrawStyle;
};

/**
 * `pitchfork` — Andrews pitchfork. The `variant` discriminator collapses
 * the four invinite tools (`standard` / `schiff` / `modifiedSchiff` /
 * `inside`) into one kind.
 *
 * @formula  median + two parallels through `anchors[1]` / `anchors[2]`
 * @anchors  anchors: [pivot, high, low]; variant: "standard"|"schiff"|"modifiedSchiff"|"inside"
 * @since 0.3
 * @stable
 * @example
 *     const s: PitchforkState = {
 *         kind: "pitchfork",
 *         variant: "modifiedSchiff",
 *         anchors: [
 *             { time: 0, price: 0 },
 *             { time: 1, price: 1 },
 *             { time: 2, price: 0.5 },
 *         ],
 *         style: {},
 *     };
 *     void s;
 */
export type PitchforkState = DrawingMeta & {
    readonly kind: "pitchfork";
    readonly anchors: AnchorTriple;
    readonly variant: "standard" | "schiff" | "modifiedSchiff" | "inside";
    readonly style: LineDrawStyle;
};

/**
 * `pitchfan` — fan-variant pitchfork (no median line).
 *
 * @formula  rays from `anchors[0]` through `anchors[1]` / `anchors[2]`
 * @anchors  anchors: [pivot, high, low]
 * @since 0.3
 * @stable
 * @example
 *     const s: PitchfanState = {
 *         kind: "pitchfan",
 *         anchors: [
 *             { time: 0, price: 0 },
 *             { time: 1, price: 1 },
 *             { time: 2, price: 0.5 },
 *         ],
 *         style: {},
 *     };
 *     void s;
 */
export type PitchfanState = DrawingMeta & {
    readonly kind: "pitchfan";
    readonly anchors: AnchorTriple;
    readonly style: LineDrawStyle;
};

/**
 * `xabcd-pattern` — harmonic pattern over five anchor pivots.
 *
 * @formula  five-leg pattern with fib-ratio retracements between adjacent legs
 * @anchors  anchors: [X, A, B, C, D]
 * @since 0.3
 * @stable
 * @example
 *     const s: XabcdPatternState = {
 *         kind: "xabcd-pattern",
 *         anchors: [
 *             { time: 0, price: 0 }, { time: 1, price: 1 },
 *             { time: 2, price: 0.5 }, { time: 3, price: 1.5 },
 *             { time: 4, price: 1 },
 *         ],
 *         style: {},
 *     };
 *     void s;
 */
export type XabcdPatternState = DrawingMeta & {
    readonly kind: "xabcd-pattern";
    readonly anchors: AnchorQuint;
    readonly style: LineDrawStyle;
};

/**
 * `cypher-pattern` — five-anchor harmonic pattern. Has no standalone
 * invinite tool (Task 20's `defineDrawing` is the only emit path).
 *
 * @formula  Cypher: XB at 0.382-0.618 of XA, XC at 1.272-1.414 of XA, XD at 0.786 of XC
 * @anchors  anchors: [X, A, B, C, D]
 * @since 0.3
 * @stable
 * @example
 *     const s: CypherPatternState = {
 *         kind: "cypher-pattern",
 *         anchors: [
 *             { time: 0, price: 0 }, { time: 1, price: 1 },
 *             { time: 2, price: 0.4 }, { time: 3, price: 1.3 },
 *             { time: 4, price: 0.6 },
 *         ],
 *         style: {},
 *     };
 *     void s;
 */
export type CypherPatternState = DrawingMeta & {
    readonly kind: "cypher-pattern";
    readonly anchors: AnchorQuint;
    readonly style: LineDrawStyle;
};

/**
 * `head-and-shoulders` — five-pivot reversal pattern.
 *
 * @formula  identity — pivot polyline with neckline at min(anchors[0].price, anchors[4].price)
 * @anchors  anchors: [leftShoulderHigh, leftLow, headHigh, rightLow, rightShoulderHigh]
 * @since 0.3
 * @stable
 * @example
 *     const s: HeadAndShouldersState = {
 *         kind: "head-and-shoulders",
 *         anchors: [
 *             { time: 0, price: 1 }, { time: 1, price: 0 },
 *             { time: 2, price: 2 }, { time: 3, price: 0 },
 *             { time: 4, price: 1 },
 *         ],
 *         style: {},
 *     };
 *     void s;
 */
export type HeadAndShouldersState = DrawingMeta & {
    readonly kind: "head-and-shoulders";
    readonly anchors: AnchorQuint;
    readonly style: LineDrawStyle;
};

/**
 * `abcd-pattern` — four-anchor measured-move pattern.
 *
 * @formula  CD = AB projected from C (fib ratio 1.0 default)
 * @anchors  anchors: [A, B, C, D]
 * @since 0.3
 * @stable
 * @example
 *     const s: AbcdPatternState = {
 *         kind: "abcd-pattern",
 *         anchors: [
 *             { time: 0, price: 0 }, { time: 1, price: 1 },
 *             { time: 2, price: 0.5 }, { time: 3, price: 1.5 },
 *         ],
 *         style: {},
 *     };
 *     void s;
 */
export type AbcdPatternState = DrawingMeta & {
    readonly kind: "abcd-pattern";
    readonly anchors: AnchorQuad;
    readonly style: LineDrawStyle;
};

/**
 * `triangle-pattern` — three-anchor triangle pattern (ascending /
 * descending / symmetrical).
 *
 * @formula  identity — three-vertex pattern outline
 * @anchors  anchors: [apex, baseHigh, baseLow]
 * @since 0.3
 * @stable
 * @example
 *     const s: TrianglePatternState = {
 *         kind: "triangle-pattern",
 *         anchors: [
 *             { time: 2, price: 0.5 },
 *             { time: 0, price: 1 },
 *             { time: 0, price: 0 },
 *         ],
 *         style: {},
 *     };
 *     void s;
 */
export type TrianglePatternState = DrawingMeta & {
    readonly kind: "triangle-pattern";
    readonly anchors: AnchorTriple;
    readonly style: LineDrawStyle;
};

/**
 * `three-drives-pattern` — six-leg three-drives reversal pattern.
 *
 * @formula  three fib-ratio drives + two corrective retracements
 * @anchors  anchors: [start, drive1, retr1, drive2, retr2, drive3, end]
 * @since 0.3
 * @stable
 * @example
 *     const s: ThreeDrivesPatternState = {
 *         kind: "three-drives-pattern",
 *         anchors: [
 *             { time: 0, price: 0 }, { time: 1, price: 1 },
 *             { time: 2, price: 0.5 }, { time: 3, price: 1.5 },
 *             { time: 4, price: 1 }, { time: 5, price: 2 },
 *             { time: 6, price: 1.5 },
 *         ],
 *         style: {},
 *     };
 *     void s;
 */
export type ThreeDrivesPatternState = DrawingMeta & {
    readonly kind: "three-drives-pattern";
    readonly anchors: AnchorHept;
    readonly style: LineDrawStyle;
};

/**
 * `elliott-impulse-wave` — five-wave impulse (1-2-3-4-5).
 *
 * @formula  identity — five-pivot polyline; per-leg fib invariants validated
 *           in the per-category port (Task 16)
 * @anchors  anchors: [wave1End, wave2End, wave3End, wave4End, wave5End]; labels?
 * @since 0.3
 * @stable
 * @example
 *     const s: ElliottImpulseWaveState = {
 *         kind: "elliott-impulse-wave",
 *         anchors: [
 *             { time: 0, price: 0 }, { time: 1, price: 1 },
 *             { time: 2, price: 0.5 }, { time: 3, price: 1.5 },
 *             { time: 4, price: 1 },
 *         ],
 *         labels: ["1", "2", "3", "4", "5"],
 *         style: {},
 *     };
 *     void s;
 */
export type ElliottImpulseWaveState = DrawingMeta & {
    readonly kind: "elliott-impulse-wave";
    readonly anchors: AnchorQuint;
    readonly labels?: ReadonlyArray<string>;
    readonly style: LineDrawStyle;
};

/**
 * `elliott-correction-wave` — three-wave A-B-C correction.
 *
 * @formula  identity — three-pivot polyline
 * @anchors  anchors: [A, B, C]; labels?
 * @since 0.3
 * @stable
 * @example
 *     const s: ElliottCorrectionWaveState = {
 *         kind: "elliott-correction-wave",
 *         anchors: [
 *             { time: 0, price: 1 },
 *             { time: 1, price: 0 },
 *             { time: 2, price: 0.5 },
 *         ],
 *         labels: ["A", "B", "C"],
 *         style: {},
 *     };
 *     void s;
 */
export type ElliottCorrectionWaveState = DrawingMeta & {
    readonly kind: "elliott-correction-wave";
    readonly anchors: AnchorTriple;
    readonly labels?: ReadonlyArray<string>;
    readonly style: LineDrawStyle;
};

/**
 * `elliott-triangle-wave` — five-wave triangle correction.
 *
 * @formula  identity — five-pivot polyline matching triangle invariants
 * @anchors  anchors: [a, b, c, d, e]; labels?
 * @since 0.3
 * @stable
 * @example
 *     const s: ElliottTriangleWaveState = {
 *         kind: "elliott-triangle-wave",
 *         anchors: [
 *             { time: 0, price: 1 }, { time: 1, price: 0 },
 *             { time: 2, price: 0.8 }, { time: 3, price: 0.2 },
 *             { time: 4, price: 0.5 },
 *         ],
 *         labels: ["a", "b", "c", "d", "e"],
 *         style: {},
 *     };
 *     void s;
 */
export type ElliottTriangleWaveState = DrawingMeta & {
    readonly kind: "elliott-triangle-wave";
    readonly anchors: AnchorQuint;
    readonly labels?: ReadonlyArray<string>;
    readonly style: LineDrawStyle;
};

/**
 * `elliott-double-combo` — seven-anchor W-X-Y double-three.
 *
 * @formula  identity — seven-pivot polyline: W three-wave + X + Y three-wave
 * @anchors  anchors: [start, W-end, x1, X-end, x2, Y-mid, Y-end]; labels?
 * @since 0.3
 * @stable
 * @example
 *     const s: ElliottDoubleComboState = {
 *         kind: "elliott-double-combo",
 *         anchors: [
 *             { time: 0, price: 0 }, { time: 1, price: 1 },
 *             { time: 2, price: 0.5 }, { time: 3, price: 1.5 },
 *             { time: 4, price: 1 }, { time: 5, price: 2 },
 *             { time: 6, price: 1.5 },
 *         ],
 *         style: {},
 *     };
 *     void s;
 */
export type ElliottDoubleComboState = DrawingMeta & {
    readonly kind: "elliott-double-combo";
    readonly anchors: AnchorHept;
    readonly labels?: ReadonlyArray<string>;
    readonly style: LineDrawStyle;
};

/**
 * `elliott-triple-combo` — seven-anchor W-X-Y-X-Z triple-three.
 *
 * @formula  identity — seven-pivot polyline: three corrective patterns joined by X waves
 * @anchors  anchors: [start, W-end, X1-end, Y-end, X2-end, Z-mid, Z-end]; labels?
 * @since 0.3
 * @stable
 * @example
 *     const s: ElliottTripleComboState = {
 *         kind: "elliott-triple-combo",
 *         anchors: [
 *             { time: 0, price: 0 }, { time: 1, price: 1 },
 *             { time: 2, price: 0.5 }, { time: 3, price: 1.5 },
 *             { time: 4, price: 1 }, { time: 5, price: 2 },
 *             { time: 6, price: 1.5 },
 *         ],
 *         style: {},
 *     };
 *     void s;
 */
export type ElliottTripleComboState = DrawingMeta & {
    readonly kind: "elliott-triple-combo";
    readonly anchors: AnchorHept;
    readonly labels?: ReadonlyArray<string>;
    readonly style: LineDrawStyle;
};

/**
 * `cyclic-lines` — equally spaced vertical lines marking cycle periods.
 *
 * @formula  vertical lines at t = A.time + n·(B.time − A.time) for n ∈ ℕ
 * @anchors  anchors: [cycleStart, cycleEnd]
 * @since 0.3
 * @stable
 * @example
 *     const s: CyclicLinesState = {
 *         kind: "cyclic-lines",
 *         anchors: [{ time: 0, price: 0 }, { time: 100, price: 0 }],
 *         style: {},
 *     };
 *     void s;
 */
export type CyclicLinesState = DrawingMeta & {
    readonly kind: "cyclic-lines";
    readonly anchors: AnchorPair;
    readonly style: LineDrawStyle;
};

/**
 * `time-cycles` — concentric semicircles measuring time cycles.
 *
 * @formula  semicircles of radius n·|AB| centred at A for n ∈ ℕ
 * @anchors  anchors: [centre, edge]
 * @since 0.3
 * @stable
 * @example
 *     const s: TimeCyclesState = {
 *         kind: "time-cycles",
 *         anchors: [{ time: 0, price: 0 }, { time: 100, price: 0 }],
 *         style: {},
 *     };
 *     void s;
 */
export type TimeCyclesState = DrawingMeta & {
    readonly kind: "time-cycles";
    readonly anchors: AnchorPair;
    readonly style: LineDrawStyle;
};

/**
 * `sine-line` — sinusoidal projection fitted between two anchors.
 *
 * @formula  y(t) = (A.price + B.price)/2 + ((B.price − A.price)/2)·sin(2π·(t − A.time)/(B.time − A.time))
 * @anchors  anchors: [periodStart, periodEnd]
 * @since 0.3
 * @stable
 * @example
 *     const s: SineLineState = {
 *         kind: "sine-line",
 *         anchors: [{ time: 0, price: 0 }, { time: 100, price: 1 }],
 *         style: {},
 *     };
 *     void s;
 */
export type SineLineState = DrawingMeta & {
    readonly kind: "sine-line";
    readonly anchors: AnchorPair;
    readonly style: LineDrawStyle;
};

/**
 * `group` — logical container for child drawings. Children are
 * referenced by handle id; rendering is delegated to the children.
 *
 * @formula  N/A — pure container; rendering passes through to children
 * @anchors  N/A — group carries no geometry, only child references
 * @since 0.3
 * @stable
 * @example
 *     const s: GroupState = {
 *         kind: "group",
 *         childHandleIds: ["h1", "h2"],
 *     };
 *     void s;
 */
export type GroupState = DrawingMeta & {
    readonly kind: "group";
    readonly childHandleIds: ReadonlyArray<string>;
    readonly meta?: Readonly<Record<string, JsonValue>>;
};

/**
 * `frame` — labelled rectangle container around child drawings. Carries
 * a background colour + label per {@link FrameOpts}.
 *
 * @formula  identity — labelled bounding rectangle around `childHandleIds`
 * @anchors  anchors: [topLeft, bottomRight]
 * @since 0.3
 * @stable
 * @example
 *     const s: FrameState = {
 *         kind: "frame",
 *         anchors: [{ time: 0, price: 0 }, { time: 1, price: 1 }],
 *         childHandleIds: [],
 *         style: { label: "Idea" },
 *     };
 *     void s;
 */
export type FrameState = DrawingMeta & {
    readonly kind: "frame";
    readonly anchors: AnchorPair;
    readonly childHandleIds: ReadonlyArray<string>;
    readonly style: FrameOpts;
};

/**
 * `table` — CSS-pixel viewport-anchored dashboard/status panel. It
 * deliberately carries no world-space anchors; adapters resolve
 * `position` against the current viewport.
 *
 * @formula  N/A — table layout resolved in CSS pixels by adapter
 * @anchors  position: CSS viewport anchor
 * @since 0.5
 * @stable
 * @example
 *     const s: TableState = {
 *         kind: "table",
 *         position: "top-right",
 *         cells: [[{ text: "P&L" }, { text: "+12.5%", textColor: "#16a34a" }]],
 *     };
 *     void s;
 */
export type TableState = DrawingMeta & {
    readonly kind: "table";
    readonly position: TablePosition;
    readonly cells: ReadonlyArray<ReadonlyArray<TableCell>>;
    readonly borderColor?: Color;
    readonly borderWidth?: number;
    readonly frame?: Readonly<{ color: Color; width: number }>;
};

/**
 * Per-kind state union — every {@link DrawingKind} maps to exactly one
 * variant. Collab-only fields (Yjs `id`, `layerId`, `createdAt`,
 * `authorId`, `parentGroupId`, `parentFrameId`, `visibleIntervals`)
 * from the invinite source are stripped.
 *
 * The 63 variants here are intentionally minimal shells. Tasks 5–18
 * (per-category ports) refine each variant's geometry + style payload
 * against the invinite source-of-truth. Exhaustiveness is asserted via
 * the `(k satisfies never)` switch in `drawingState.types.test.ts`.
 *
 * @formula  discriminated union — switch on `state.kind` to read variant
 * @anchors  per-variant — see the individual `*State` declarations above
 * @since 0.3
 * @stable
 * @example
 *     const s: DrawingState = {
 *         kind: "horizontal-line",
 *         price: 100,
 *         style: { color: "#3b82f6" },
 *     };
 *     void s;
 */
export type DrawingState =
    | LineState
    | HorizontalLineState
    | HorizontalRayState
    | VerticalLineState
    | CrossLineState
    | TrendAngleState
    | RectangleState
    | RotatedRectangleState
    | TriangleState
    | PolylineState
    | CircleState
    | EllipseState
    | PathState
    | FillBetweenState
    | MarkerState
    | ArcState
    | CurveState
    | DoubleCurveState
    | PenState
    | HighlighterState
    | BrushState
    | TextState
    | ArrowState
    | ArrowMarkerState
    | ArrowMarkUpState
    | ArrowMarkDownState
    | TrendChannelState
    | FlatTopBottomState
    | DisjointChannelState
    | RegressionTrendState
    | FibRetracementState
    | FibTrendExtensionState
    | FibChannelState
    | FibTimeZoneState
    | FibWedgeState
    | FibSpeedFanState
    | FibSpeedArcsState
    | FibSpiralState
    | FibCirclesState
    | FibTrendTimeState
    | GannBoxState
    | GannSquareFixedState
    | GannSquareState
    | GannFanState
    | PitchforkState
    | PitchfanState
    | XabcdPatternState
    | CypherPatternState
    | HeadAndShouldersState
    | AbcdPatternState
    | TrianglePatternState
    | ThreeDrivesPatternState
    | ElliottImpulseWaveState
    | ElliottCorrectionWaveState
    | ElliottTriangleWaveState
    | ElliottDoubleComboState
    | ElliottTripleComboState
    | CyclicLinesState
    | TimeCyclesState
    | SineLineState
    | GroupState
    | FrameState
    | TableState;
