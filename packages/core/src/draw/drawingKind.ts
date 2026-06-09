// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * The full set of 62 drawing kinds chartlang supports through `draw.*`.
 * The wire format is kebab-case; the TypeScript script surface is
 * camelCase (`draw.horizontalLine(...)`). See {@link KIND_CAMELCASE} for
 * the canonical bijection.
 *
 * Variant collapses pinned in PLAN.md §3.1:
 *
 * - `ray` / `extended-line` collapse into `line` with `extendLeft` /
 *   `extendRight` flags on the state.
 * - The 4 invinite pitchfork tools (`standard` / `schiff` /
 *   `modifiedSchiff` / `inside`) collapse into `pitchfork` with a
 *   `variant` discriminator on the state.
 * - `cypher-pattern` has no standalone tool — emittable only through
 *   `defineDrawing` (Task 20).
 *
 * Order pinned: lines (6) → boxes (8) → curves (3) → freehand (3) →
 * annotations (5) → channels (4) → fib (10) → gann (4) → pitchforks (2)
 * → patterns (6) → elliott (5) → cycles (3) → containers (2) → viewport
 * overlays (1) = 62. The order is wire-stable — downstream consumers iterate
 * {@link DRAWING_KINDS} in this order for diagnostic readability.
 *
 * @formula  N/A — discriminator constant set
 * @anchors  62 kebab-case kind names; see {@link DRAWING_KINDS}
 * @since 0.3
 * @experimental
 * @example
 *     const k: DrawingKind = "fib-retracement";
 *     void k;
 */
export type DrawingKind =
    // Lines / Rays (6)
    | "line"
    | "horizontal-line"
    | "horizontal-ray"
    | "vertical-line"
    | "cross-line"
    | "trend-angle"
    // Boxes / Shapes (8)
    | "rectangle"
    | "rotated-rectangle"
    | "triangle"
    | "polyline"
    | "circle"
    | "ellipse"
    | "path"
    | "marker"
    // Curves (3)
    | "arc"
    | "curve"
    | "double-curve"
    // Freehand (3)
    | "pen"
    | "highlighter"
    | "brush"
    // Annotations (5)
    | "text"
    | "arrow"
    | "arrow-marker"
    | "arrow-mark-up"
    | "arrow-mark-down"
    // Channels (4)
    | "trend-channel"
    | "flat-top-bottom"
    | "disjoint-channel"
    | "regression-trend"
    // Fibonacci (10)
    | "fib-retracement"
    | "fib-trend-extension"
    | "fib-channel"
    | "fib-time-zone"
    | "fib-wedge"
    | "fib-speed-fan"
    | "fib-speed-arcs"
    | "fib-spiral"
    | "fib-circles"
    | "fib-trend-time"
    // Gann (4)
    | "gann-box"
    | "gann-square-fixed"
    | "gann-square"
    | "gann-fan"
    // Pitchforks (2)
    | "pitchfork"
    | "pitchfan"
    // Harmonic Patterns (6)
    | "xabcd-pattern"
    | "cypher-pattern"
    | "head-and-shoulders"
    | "abcd-pattern"
    | "triangle-pattern"
    | "three-drives-pattern"
    // Elliott Waves (5)
    | "elliott-impulse-wave"
    | "elliott-correction-wave"
    | "elliott-triangle-wave"
    | "elliott-double-combo"
    | "elliott-triple-combo"
    // Cycles (3)
    | "cyclic-lines"
    | "time-cycles"
    | "sine-line"
    // Containers (2)
    | "group"
    | "frame"
    // Viewport overlays (1)
    | "table";

/**
 * Iterable form of {@link DrawingKind}. Order matches the type
 * declaration so docs / validators / dispatchers can walk the set in a
 * single canonical order. Frozen.
 *
 * @formula  N/A — discriminator constant set
 * @anchors  62 kebab-case kind names; see {@link DRAWING_KINDS}
 * @since 0.3
 * @experimental
 * @example
 *     import { DRAWING_KINDS } from "@invinite-org/chartlang-core";
 *     for (const k of DRAWING_KINDS) {
 *         void k;
 *     }
 */
export const DRAWING_KINDS: ReadonlyArray<DrawingKind> = Object.freeze([
    "line",
    "horizontal-line",
    "horizontal-ray",
    "vertical-line",
    "cross-line",
    "trend-angle",
    "rectangle",
    "rotated-rectangle",
    "triangle",
    "polyline",
    "circle",
    "ellipse",
    "path",
    "marker",
    "arc",
    "curve",
    "double-curve",
    "pen",
    "highlighter",
    "brush",
    "text",
    "arrow",
    "arrow-marker",
    "arrow-mark-up",
    "arrow-mark-down",
    "trend-channel",
    "flat-top-bottom",
    "disjoint-channel",
    "regression-trend",
    "fib-retracement",
    "fib-trend-extension",
    "fib-channel",
    "fib-time-zone",
    "fib-wedge",
    "fib-speed-fan",
    "fib-speed-arcs",
    "fib-spiral",
    "fib-circles",
    "fib-trend-time",
    "gann-box",
    "gann-square-fixed",
    "gann-square",
    "gann-fan",
    "pitchfork",
    "pitchfan",
    "xabcd-pattern",
    "cypher-pattern",
    "head-and-shoulders",
    "abcd-pattern",
    "triangle-pattern",
    "three-drives-pattern",
    "elliott-impulse-wave",
    "elliott-correction-wave",
    "elliott-triangle-wave",
    "elliott-double-combo",
    "elliott-triple-combo",
    "cyclic-lines",
    "time-cycles",
    "sine-line",
    "group",
    "frame",
    "table",
] as const satisfies ReadonlyArray<DrawingKind>);

/**
 * camelCase TypeScript-surface name for every kind. Used by the editor
 * + gen-docs + the compiler's `STATEFUL_PRIMITIVES` lookup so a script
 * author writes `draw.horizontalLine(...)` while the wire format stays
 * kebab-case (`horizontal-line`). The bijection round-trips through
 * {@link KIND_KEBABCASE}.
 *
 * @formula  N/A — discriminator constant set
 * @anchors  62 kebab-case kind names; see {@link DRAWING_KINDS}
 * @since 0.3
 * @experimental
 * @example
 *     import { KIND_CAMELCASE } from "@invinite-org/chartlang-core";
 *     const camel = KIND_CAMELCASE.get("horizontal-line"); // "horizontalLine"
 *     void camel;
 */
export const KIND_CAMELCASE: ReadonlyMap<DrawingKind, string> = new Map<DrawingKind, string>([
    ["line", "line"],
    ["horizontal-line", "horizontalLine"],
    ["horizontal-ray", "horizontalRay"],
    ["vertical-line", "verticalLine"],
    ["cross-line", "crossLine"],
    ["trend-angle", "trendAngle"],
    ["rectangle", "rectangle"],
    ["rotated-rectangle", "rotatedRectangle"],
    ["triangle", "triangle"],
    ["polyline", "polyline"],
    ["circle", "circle"],
    ["ellipse", "ellipse"],
    ["path", "path"],
    ["marker", "marker"],
    ["arc", "arc"],
    ["curve", "curve"],
    ["double-curve", "doubleCurve"],
    ["pen", "pen"],
    ["highlighter", "highlighter"],
    ["brush", "brush"],
    ["text", "text"],
    ["arrow", "arrow"],
    ["arrow-marker", "arrowMarker"],
    ["arrow-mark-up", "arrowMarkUp"],
    ["arrow-mark-down", "arrowMarkDown"],
    ["trend-channel", "trendChannel"],
    ["flat-top-bottom", "flatTopBottom"],
    ["disjoint-channel", "disjointChannel"],
    ["regression-trend", "regressionTrend"],
    ["fib-retracement", "fibRetracement"],
    ["fib-trend-extension", "fibTrendExtension"],
    ["fib-channel", "fibChannel"],
    ["fib-time-zone", "fibTimeZone"],
    ["fib-wedge", "fibWedge"],
    ["fib-speed-fan", "fibSpeedFan"],
    ["fib-speed-arcs", "fibSpeedArcs"],
    ["fib-spiral", "fibSpiral"],
    ["fib-circles", "fibCircles"],
    ["fib-trend-time", "fibTrendTime"],
    ["gann-box", "gannBox"],
    ["gann-square-fixed", "gannSquareFixed"],
    ["gann-square", "gannSquare"],
    ["gann-fan", "gannFan"],
    ["pitchfork", "pitchfork"],
    ["pitchfan", "pitchfan"],
    ["xabcd-pattern", "xabcdPattern"],
    ["cypher-pattern", "cypherPattern"],
    ["head-and-shoulders", "headAndShoulders"],
    ["abcd-pattern", "abcdPattern"],
    ["triangle-pattern", "trianglePattern"],
    ["three-drives-pattern", "threeDrivesPattern"],
    ["elliott-impulse-wave", "elliottImpulseWave"],
    ["elliott-correction-wave", "elliottCorrectionWave"],
    ["elliott-triangle-wave", "elliottTriangleWave"],
    ["elliott-double-combo", "elliottDoubleCombo"],
    ["elliott-triple-combo", "elliottTripleCombo"],
    ["cyclic-lines", "cyclicLines"],
    ["time-cycles", "timeCycles"],
    ["sine-line", "sineLine"],
    ["group", "group"],
    ["frame", "frame"],
    ["table", "table"],
]);

/**
 * Inverse of {@link KIND_CAMELCASE} — camelCase TypeScript surface
 * name → kebab-case wire kind. Derived from `KIND_CAMELCASE` so the
 * two maps cannot drift.
 *
 * @formula  N/A — discriminator constant set
 * @anchors  62 kebab-case kind names; see {@link DRAWING_KINDS}
 * @since 0.3
 * @experimental
 * @example
 *     import { KIND_KEBABCASE } from "@invinite-org/chartlang-core";
 *     const kebab = KIND_KEBABCASE.get("horizontalLine"); // "horizontal-line"
 *     void kebab;
 */
export const KIND_KEBABCASE: ReadonlyMap<string, DrawingKind> = new Map<string, DrawingKind>(
    Array.from(KIND_CAMELCASE, ([kebab, camel]) => [camel, kebab]),
);
