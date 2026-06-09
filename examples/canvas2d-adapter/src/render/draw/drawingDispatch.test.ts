// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import {
    DRAWING_KINDS,
    type AbcdPatternState,
    type ArcState,
    type ArrowMarkDownState,
    type ArrowMarkUpState,
    type ArrowMarkerState,
    type ArrowState,
    type BrushState,
    type CircleState,
    type CrossLineState,
    type CurveState,
    type CyclicLinesState,
    type CypherPatternState,
    type DisjointChannelState,
    type DoubleCurveState,
    type DrawingKind,
    type DrawingState,
    type ElliottCorrectionWaveState,
    type ElliottDoubleComboState,
    type ElliottImpulseWaveState,
    type ElliottTriangleWaveState,
    type ElliottTripleComboState,
    type EllipseState,
    type FibChannelState,
    type FibCirclesState,
    type FibRetracementState,
    type FibSpeedArcsState,
    type FibSpeedFanState,
    type FibSpiralState,
    type FibTimeZoneState,
    type FibTrendExtensionState,
    type FibTrendTimeState,
    type FibWedgeState,
    type FlatTopBottomState,
    type FrameState,
    type GannBoxState,
    type GannFanState,
    type GannSquareFixedState,
    type GannSquareState,
    type GroupState,
    type HeadAndShouldersState,
    type HighlighterState,
    type HorizontalLineState,
    type HorizontalRayState,
    type LineState,
    type MarkerState,
    type PathState,
    type PenState,
    type PitchfanState,
    type PitchforkState,
    type PolylineState,
    type RectangleState,
    type RegressionTrendState,
    type RotatedRectangleState,
    type SineLineState,
    type TableState,
    type TextState,
    type ThreeDrivesPatternState,
    type TimeCyclesState,
    type TrendAngleState,
    type TrendChannelState,
    type TrianglePatternState,
    type TriangleState,
    type VerticalLineState,
    type XabcdPatternState,
} from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords";
import { MockCanvas2DContext } from "../../testing";
import { drawingDispatch } from "./drawingDispatch";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

// Line-family kinds shipped in Task 5 — the dispatch now routes these
// to a real renderer.
const TASK_5_LINE_KINDS: ReadonlySet<DrawingKind> = new Set([
    "line",
    "horizontal-line",
    "horizontal-ray",
    "vertical-line",
    "cross-line",
    "trend-angle",
]);

// Box-A kinds shipped in Task 6.
const TASK_6_BOX_A_KINDS: ReadonlySet<DrawingKind> = new Set([
    "rectangle",
    "rotated-rectangle",
    "triangle",
    "polyline",
]);

// Box-B kinds shipped in Task 7.
const TASK_7_BOX_B_KINDS: ReadonlySet<DrawingKind> = new Set([
    "circle",
    "ellipse",
    "path",
    "marker",
]);

// Curve + freehand kinds shipped in Task 8.
const TASK_8_CURVE_FREEHAND_KINDS: ReadonlySet<DrawingKind> = new Set([
    "arc",
    "curve",
    "double-curve",
    "pen",
    "highlighter",
    "brush",
]);

// Annotation kinds shipped in Task 9.
const TASK_9_ANNOTATION_KINDS: ReadonlySet<DrawingKind> = new Set([
    "text",
    "arrow",
    "arrow-marker",
    "arrow-mark-up",
    "arrow-mark-down",
]);

// Channel kinds shipped in Task 10.
const TASK_10_CHANNEL_KINDS: ReadonlySet<DrawingKind> = new Set([
    "trend-channel",
    "flat-top-bottom",
    "disjoint-channel",
    "regression-trend",
]);

// Fibonacci-A kinds shipped in Task 11.
const TASK_11_FIB_A_KINDS: ReadonlySet<DrawingKind> = new Set([
    "fib-retracement",
    "fib-trend-extension",
    "fib-channel",
    "fib-time-zone",
    "fib-wedge",
]);

// Fibonacci-B kinds shipped in Task 12.
const TASK_12_FIB_B_KINDS: ReadonlySet<DrawingKind> = new Set([
    "fib-speed-fan",
    "fib-speed-arcs",
    "fib-spiral",
    "fib-circles",
    "fib-trend-time",
]);

// Gann kinds shipped in Task 13.
const TASK_13_GANN_KINDS: ReadonlySet<DrawingKind> = new Set([
    "gann-box",
    "gann-square-fixed",
    "gann-square",
    "gann-fan",
]);

// Pitchfork kinds shipped in Task 14.
const TASK_14_PITCHFORK_KINDS: ReadonlySet<DrawingKind> = new Set(["pitchfork", "pitchfan"]);

// Harmonic-pattern kinds shipped in Task 15.
const TASK_15_PATTERN_KINDS: ReadonlySet<DrawingKind> = new Set([
    "xabcd-pattern",
    "cypher-pattern",
    "head-and-shoulders",
    "abcd-pattern",
    "triangle-pattern",
    "three-drives-pattern",
]);

// Elliott-wave kinds shipped in Task 16.
const TASK_16_ELLIOTT_KINDS: ReadonlySet<DrawingKind> = new Set([
    "elliott-impulse-wave",
    "elliott-correction-wave",
    "elliott-triangle-wave",
    "elliott-double-combo",
    "elliott-triple-combo",
]);

// Cycle kinds shipped in Task 17.
const TASK_17_CYCLE_KINDS: ReadonlySet<DrawingKind> = new Set([
    "cyclic-lines",
    "time-cycles",
    "sine-line",
]);

// Container kinds shipped in Task 18. Only `frame` produces visible
// canvas calls; `group` is a pure no-op renderer (Phase-3 contract —
// the bounding-box-of-children envelope is a Phase-4 follow-up) and
// therefore stays out of `RENDERING_KINDS` even though both arms in
// `drawingDispatch` are now flipped to call real renderers.
const TASK_18_VISIBLE_CONTAINER_KINDS: ReadonlySet<DrawingKind> = new Set(["frame"]);

// Viewport table kinds shipped in Phase 5.
const PHASE_5_TABLE_KINDS: ReadonlySet<DrawingKind> = new Set(["table"]);

const RENDERING_KINDS: ReadonlySet<DrawingKind> = new Set([
    ...TASK_5_LINE_KINDS,
    ...TASK_6_BOX_A_KINDS,
    ...TASK_7_BOX_B_KINDS,
    ...TASK_8_CURVE_FREEHAND_KINDS,
    ...TASK_9_ANNOTATION_KINDS,
    ...TASK_10_CHANNEL_KINDS,
    ...TASK_11_FIB_A_KINDS,
    ...TASK_12_FIB_B_KINDS,
    ...TASK_13_GANN_KINDS,
    ...TASK_14_PITCHFORK_KINDS,
    ...TASK_15_PATTERN_KINDS,
    ...TASK_16_ELLIOTT_KINDS,
    ...TASK_17_CYCLE_KINDS,
    ...TASK_18_VISIBLE_CONTAINER_KINDS,
    ...PHASE_5_TABLE_KINDS,
]);

function syntheticState(kind: DrawingKind): DrawingState {
    // Construct minimal well-formed state for the 6 kinds that now
    // render, then a synthetic `{ kind }` shell for the still-stubbed
    // kinds (the no-op arms never read `state`).
    if (kind === "line") {
        const s: LineState = {
            kind: "line",
            anchors: [
                { time: 0, price: 50 },
                { time: 100, price: 50 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "horizontal-line") {
        const s: HorizontalLineState = { kind: "horizontal-line", price: 50, style: {} };
        return s;
    }
    if (kind === "horizontal-ray") {
        const s: HorizontalRayState = {
            kind: "horizontal-ray",
            anchor: { time: 0, price: 50 },
            style: {},
        };
        return s;
    }
    if (kind === "vertical-line") {
        const s: VerticalLineState = { kind: "vertical-line", time: 50, style: {} };
        return s;
    }
    if (kind === "cross-line") {
        const s: CrossLineState = {
            kind: "cross-line",
            anchor: { time: 50, price: 50 },
            style: {},
        };
        return s;
    }
    if (kind === "trend-angle") {
        const s: TrendAngleState = {
            kind: "trend-angle",
            anchors: [
                { time: 0, price: 0 },
                { time: 50, price: 50 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "rectangle") {
        const s: RectangleState = {
            kind: "rectangle",
            anchors: [
                { time: 0, price: 0 },
                { time: 50, price: 50 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "rotated-rectangle") {
        const s: RotatedRectangleState = {
            kind: "rotated-rectangle",
            anchors: [
                { time: 0, price: 0 },
                { time: 50, price: 50 },
                { time: 100, price: 0 },
                { time: 50, price: -50 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "triangle") {
        const s: TriangleState = {
            kind: "triangle",
            anchors: [
                { time: 0, price: 0 },
                { time: 50, price: 50 },
                { time: 100, price: 0 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "polyline") {
        const s: PolylineState = {
            kind: "polyline",
            anchors: [
                { time: 0, price: 0 },
                { time: 50, price: 50 },
                { time: 100, price: 0 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "circle") {
        const s: CircleState = {
            kind: "circle",
            anchors: [
                { time: 50, price: 50 },
                { time: 75, price: 50 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "ellipse") {
        const s: EllipseState = {
            kind: "ellipse",
            anchors: [
                { time: 0, price: 0 },
                { time: 100, price: 100 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "path") {
        const s: PathState = {
            kind: "path",
            anchors: [
                { time: 0, price: 0 },
                { time: 50, price: 50 },
                { time: 100, price: 0 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "marker") {
        const s: MarkerState = {
            kind: "marker",
            anchor: { time: 50, price: 50 },
            text: "B",
            style: {},
        };
        return s;
    }
    if (kind === "arc") {
        const s: ArcState = {
            kind: "arc",
            anchors: [
                { time: 0, price: 0 },
                { time: 50, price: 50 },
                { time: 100, price: 0 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "curve") {
        const s: CurveState = {
            kind: "curve",
            anchors: [
                { time: 0, price: 0 },
                { time: 50, price: 50 },
                { time: 100, price: 0 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "double-curve") {
        const s: DoubleCurveState = {
            kind: "double-curve",
            anchors: [
                { time: 0, price: 0 },
                { time: 25, price: 25 },
                { time: 50, price: 0 },
                { time: 75, price: -25 },
                { time: 100, price: 0 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "pen") {
        const s: PenState = {
            kind: "pen",
            anchors: [
                { time: 0, price: 0 },
                { time: 50, price: 50 },
                { time: 100, price: 0 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "highlighter") {
        const s: HighlighterState = {
            kind: "highlighter",
            anchors: [
                { time: 0, price: 0 },
                { time: 50, price: 50 },
            ],
            style: { color: "#facc15", alpha: 0.3 },
        };
        return s;
    }
    if (kind === "brush") {
        const s: BrushState = {
            kind: "brush",
            anchors: [
                { time: 0, price: 0 },
                { time: 50, price: 50 },
                { time: 100, price: 0 },
            ],
            style: { stroke: "#000000", fill: "#dbeafe" },
        };
        return s;
    }
    if (kind === "text") {
        const s: TextState = {
            kind: "text",
            anchor: { time: 50, price: 50 },
            body: "Note",
            style: {},
        };
        return s;
    }
    if (kind === "arrow") {
        const s: ArrowState = {
            kind: "arrow",
            anchors: [
                { time: 0, price: 0 },
                { time: 100, price: 100 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "arrow-marker") {
        const s: ArrowMarkerState = {
            kind: "arrow-marker",
            anchor: { time: 50, price: 50 },
            style: {},
        };
        return s;
    }
    if (kind === "arrow-mark-up") {
        const s: ArrowMarkUpState = {
            kind: "arrow-mark-up",
            anchor: { time: 50, price: 50 },
            style: {},
        };
        return s;
    }
    if (kind === "arrow-mark-down") {
        const s: ArrowMarkDownState = {
            kind: "arrow-mark-down",
            anchor: { time: 50, price: 50 },
            style: {},
        };
        return s;
    }
    if (kind === "trend-channel") {
        const s: TrendChannelState = {
            kind: "trend-channel",
            anchors: [
                { time: 0, price: 0 },
                { time: 100, price: 100 },
                { time: 0, price: 50 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "flat-top-bottom") {
        const s: FlatTopBottomState = {
            kind: "flat-top-bottom",
            anchors: [
                { time: 0, price: 80 },
                { time: 100, price: 80 },
                { time: 0, price: 20 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "disjoint-channel") {
        const s: DisjointChannelState = {
            kind: "disjoint-channel",
            anchors: [
                { time: 0, price: 0 },
                { time: 100, price: 100 },
                { time: 0, price: 50 },
                { time: 100, price: 50 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "regression-trend") {
        const s: RegressionTrendState = {
            kind: "regression-trend",
            anchors: [
                { time: 0, price: 0 },
                { time: 100, price: 100 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "fib-retracement") {
        const s: FibRetracementState = {
            kind: "fib-retracement",
            anchors: [
                { time: 0, price: 0 },
                { time: 100, price: 100 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "fib-trend-extension") {
        const s: FibTrendExtensionState = {
            kind: "fib-trend-extension",
            anchors: [
                { time: 0, price: 0 },
                { time: 50, price: 100 },
                { time: 100, price: 50 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "fib-channel") {
        const s: FibChannelState = {
            kind: "fib-channel",
            anchors: [
                { time: 0, price: 0 },
                { time: 100, price: 100 },
                { time: 0, price: 50 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "fib-time-zone") {
        const s: FibTimeZoneState = {
            kind: "fib-time-zone",
            anchors: [
                { time: 0, price: 0 },
                { time: 100, price: 0 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "fib-wedge") {
        const s: FibWedgeState = {
            kind: "fib-wedge",
            anchors: [
                { time: 0, price: 0 },
                { time: 100, price: 100 },
                { time: 100, price: -100 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "fib-speed-fan") {
        const s: FibSpeedFanState = {
            kind: "fib-speed-fan",
            anchors: [
                { time: 0, price: 0 },
                { time: 50, price: 50 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "fib-speed-arcs") {
        const s: FibSpeedArcsState = {
            kind: "fib-speed-arcs",
            anchors: [
                { time: 50, price: 50 },
                { time: 80, price: 50 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "fib-spiral") {
        const s: FibSpiralState = {
            kind: "fib-spiral",
            anchors: [
                { time: 50, price: 50 },
                { time: 80, price: 50 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "fib-circles") {
        const s: FibCirclesState = {
            kind: "fib-circles",
            anchors: [
                { time: 50, price: 50 },
                { time: 80, price: 50 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "fib-trend-time") {
        const s: FibTrendTimeState = {
            kind: "fib-trend-time",
            anchors: [
                { time: 0, price: 0 },
                { time: 30, price: 50 },
                { time: 50, price: 25 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "gann-box") {
        const s: GannBoxState = {
            kind: "gann-box",
            anchors: [
                { time: 0, price: 0 },
                { time: 100, price: 100 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "gann-square-fixed") {
        const s: GannSquareFixedState = {
            kind: "gann-square-fixed",
            anchor: { time: 50, price: 50 },
            style: {},
        };
        return s;
    }
    if (kind === "gann-square") {
        const s: GannSquareState = {
            kind: "gann-square",
            anchors: [
                { time: 0, price: 0 },
                { time: 100, price: 100 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "gann-fan") {
        const s: GannFanState = {
            kind: "gann-fan",
            anchors: [
                { time: 0, price: 0 },
                { time: 50, price: 50 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "pitchfork") {
        const s: PitchforkState = {
            kind: "pitchfork",
            anchors: [
                { time: 0, price: 0 },
                { time: 30, price: 50 },
                { time: 50, price: 25 },
            ],
            variant: "standard",
            style: {},
        };
        return s;
    }
    if (kind === "pitchfan") {
        const s: PitchfanState = {
            kind: "pitchfan",
            anchors: [
                { time: 0, price: 0 },
                { time: 30, price: 50 },
                { time: 50, price: 25 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "xabcd-pattern") {
        const s: XabcdPatternState = {
            kind: "xabcd-pattern",
            anchors: [
                { time: 0, price: 0 },
                { time: 20, price: 50 },
                { time: 40, price: 25 },
                { time: 60, price: 75 },
                { time: 80, price: 40 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "cypher-pattern") {
        const s: CypherPatternState = {
            kind: "cypher-pattern",
            anchors: [
                { time: 0, price: 0 },
                { time: 20, price: 60 },
                { time: 40, price: 30 },
                { time: 60, price: 80 },
                { time: 80, price: 45 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "head-and-shoulders") {
        const s: HeadAndShouldersState = {
            kind: "head-and-shoulders",
            anchors: [
                { time: 10, price: 60 },
                { time: 30, price: 30 },
                { time: 50, price: 80 },
                { time: 70, price: 30 },
                { time: 90, price: 60 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "abcd-pattern") {
        const s: AbcdPatternState = {
            kind: "abcd-pattern",
            anchors: [
                { time: 0, price: 0 },
                { time: 30, price: 50 },
                { time: 60, price: 25 },
                { time: 90, price: 70 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "triangle-pattern") {
        const s: TrianglePatternState = {
            kind: "triangle-pattern",
            anchors: [
                { time: 80, price: 50 },
                { time: 0, price: 70 },
                { time: 0, price: 30 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "three-drives-pattern") {
        const s: ThreeDrivesPatternState = {
            kind: "three-drives-pattern",
            anchors: [
                { time: 0, price: 0 },
                { time: 15, price: 30 },
                { time: 30, price: 20 },
                { time: 45, price: 50 },
                { time: 60, price: 40 },
                { time: 75, price: 70 },
                { time: 90, price: 60 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "elliott-impulse-wave") {
        const s: ElliottImpulseWaveState = {
            kind: "elliott-impulse-wave",
            anchors: [
                { time: 0, price: 0 },
                { time: 20, price: 50 },
                { time: 40, price: 25 },
                { time: 60, price: 75 },
                { time: 80, price: 40 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "elliott-correction-wave") {
        const s: ElliottCorrectionWaveState = {
            kind: "elliott-correction-wave",
            anchors: [
                { time: 0, price: 60 },
                { time: 30, price: 20 },
                { time: 60, price: 40 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "elliott-triangle-wave") {
        const s: ElliottTriangleWaveState = {
            kind: "elliott-triangle-wave",
            anchors: [
                { time: 0, price: 60 },
                { time: 20, price: 20 },
                { time: 40, price: 55 },
                { time: 60, price: 25 },
                { time: 80, price: 40 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "elliott-double-combo") {
        const s: ElliottDoubleComboState = {
            kind: "elliott-double-combo",
            anchors: [
                { time: 0, price: 0 },
                { time: 15, price: 30 },
                { time: 30, price: 20 },
                { time: 45, price: 50 },
                { time: 60, price: 40 },
                { time: 75, price: 70 },
                { time: 90, price: 60 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "elliott-triple-combo") {
        const s: ElliottTripleComboState = {
            kind: "elliott-triple-combo",
            anchors: [
                { time: 0, price: 0 },
                { time: 15, price: 30 },
                { time: 30, price: 20 },
                { time: 45, price: 50 },
                { time: 60, price: 40 },
                { time: 75, price: 70 },
                { time: 90, price: 60 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "cyclic-lines") {
        const s: CyclicLinesState = {
            kind: "cyclic-lines",
            anchors: [
                { time: 0, price: 50 },
                { time: 10, price: 50 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "time-cycles") {
        const s: TimeCyclesState = {
            kind: "time-cycles",
            anchors: [
                { time: 40, price: 50 },
                { time: 60, price: 50 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "sine-line") {
        const s: SineLineState = {
            kind: "sine-line",
            anchors: [
                { time: 0, price: 40 },
                { time: 25, price: 60 },
            ],
            style: {},
        };
        return s;
    }
    if (kind === "group") {
        const s: GroupState = {
            kind: "group",
            childHandleIds: ["h1", "h2"],
        };
        return s;
    }
    if (kind === "frame") {
        const s: FrameState = {
            kind: "frame",
            anchors: [
                { time: 10, price: 20 },
                { time: 60, price: 70 },
            ],
            childHandleIds: [],
            style: { label: "Idea", bgColor: "#f1f5f9" },
        };
        return s;
    }
    if (kind === "table") {
        const s: TableState = {
            kind: "table",
            position: "top-right",
            cells: [[{ text: "P&L" }, { text: "+12.5%", textColor: "#16a34a" }]],
            borderColor: "#94a3b8",
            borderWidth: 1,
        };
        return s;
    }
    return { kind } as unknown as DrawingState;
}

function syntheticEmission(
    kind: DrawingKind,
    op: "create" | "update" | "remove" = "create",
): DrawingEmission {
    return {
        kind: "drawing",
        handleId: `synthetic#${kind}`,
        drawingKind: kind,
        op,
        state: syntheticState(kind),
        bar: 0,
        time: 0,
    };
}

describe("drawingDispatch — Tasks 5–18 shipped kinds touch the context", () => {
    it.each([...RENDERING_KINDS])(
        "dispatches '%s' (op:create) and records at least one canvas call",
        (kind) => {
            const ctx = new MockCanvas2DContext();
            drawingDispatch(ctx, syntheticEmission(kind, "create"), VIEW);
            expect(ctx.calls.length).toBeGreaterThan(0);
        },
    );

    it("'cross-line' issues two separate beginPath/stroke pairs (horizontal + vertical)", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("cross-line", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "beginPath")).toHaveLength(2);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(2);
    });

    it("'trend-angle' issues an arc + a fillText angle label", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("trend-angle", "create"), VIEW);
        expect(ctx.calls.some((c) => c.kind === "arc")).toBe(true);
        const textCall = ctx.calls.find((c) => c.kind === "fillText");
        expect(textCall).toBeDefined();
        if (textCall !== undefined && textCall.kind === "fillText") {
            expect(textCall.text).toMatch(/°$/);
        }
    });

    it("'circle' issues exactly one arc call (single ctx.arc draws the full ring)", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("circle", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "arc")).toHaveLength(1);
    });

    it("'ellipse' approximates the ring with a 64-segment polyline (63 lineTo calls)", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("ellipse", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "lineTo")).toHaveLength(63);
        expect(ctx.calls.filter((c) => c.kind === "arc")).toHaveLength(0);
    });

    it("'path' (open by default) issues no closePath", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("path", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "closePath")).toHaveLength(0);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
    });

    it("'marker' issues exactly one fillText call (no stroke / beginPath)", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("marker", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "fillText")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(0);
        expect(ctx.calls.filter((c) => c.kind === "beginPath")).toHaveLength(0);
    });

    it("'arc' samples the curve as a 32-segment polyline (32 lineTo calls)", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("arc", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "lineTo")).toHaveLength(32);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
    });

    it("'curve' samples the quadratic Bezier as a 32-segment polyline", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("curve", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "lineTo")).toHaveLength(32);
    });

    it("'double-curve' samples the cubic Bezier as a 32-segment polyline", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("double-curve", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "lineTo")).toHaveLength(32);
    });

    it("'pen' strokes an OPEN polyline (no closePath, no fill)", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("pen", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "closePath")).toHaveLength(0);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(0);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
    });

    it("'highlighter' brackets the stroke with globalAlpha set/reset", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("highlighter", "create"), VIEW);
        const alphaCalls = ctx.calls.filter((c) => c.kind === "set" && c.prop === "globalAlpha");
        expect(alphaCalls).toHaveLength(2);
    });

    it("'brush' fills before stroking with a closed path", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("brush", "create"), VIEW);
        const order = ctx.calls.map((c) => c.kind);
        expect(order.indexOf("fill")).toBeGreaterThan(-1);
        expect(order.indexOf("closePath")).toBeGreaterThan(-1);
        expect(order.indexOf("fill")).toBeLessThan(order.indexOf("stroke"));
    });

    it("'text' issues exactly one fillText call (no stroke / beginPath / fillRect)", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("text", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "fillText")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(0);
        expect(ctx.calls.filter((c) => c.kind === "beginPath")).toHaveLength(0);
        expect(ctx.calls.filter((c) => c.kind === "fillRect")).toHaveLength(0);
    });

    it("'arrow' strokes one shaft and fills one arrowhead", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("arrow", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(1);
    });

    it("'arrow-marker' composes dot (arc + fill) + stub (stroke) + arrowhead (fill)", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("arrow-marker", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "arc")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(2);
    });

    it("'arrow-mark-up' fills a single triangle defaulting to green (#22c55e)", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("arrow-mark-up", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(1);
        const fillStyleCall = ctx.calls.find((c) => c.kind === "set" && c.prop === "fillStyle");
        if (fillStyleCall?.kind === "set") expect(fillStyleCall.value).toBe("#22c55e");
    });

    it("'arrow-mark-down' fills a single triangle defaulting to red (#ef4444)", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("arrow-mark-down", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(1);
        const fillStyleCall = ctx.calls.find((c) => c.kind === "set" && c.prop === "fillStyle");
        if (fillStyleCall?.kind === "set") expect(fillStyleCall.value).toBe("#ef4444");
    });

    it("'trend-channel' strokes two parallel line segments", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("trend-channel", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "beginPath")).toHaveLength(2);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(2);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(0);
    });

    it("'flat-top-bottom' strokes two horizontal rails", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("flat-top-bottom", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "beginPath")).toHaveLength(2);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(2);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(0);
    });

    it("'disjoint-channel' strokes two independent line segments", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("disjoint-channel", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "beginPath")).toHaveLength(2);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(2);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(0);
    });

    it("'regression-trend' strokes a single placeholder line defaulting to invinite blue", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("regression-trend", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
        const strokeStyleCall = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (strokeStyleCall?.kind === "set") expect(strokeStyleCall.value).toBe("#3b82f6");
    });

    it("'fib-retracement' strokes one rail per default FIB_LEVELS entry (>= 10 strokes)", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("fib-retracement", "create"), VIEW);
        const strokes = ctx.calls.filter((c) => c.kind === "stroke").length;
        expect(strokes).toBeGreaterThanOrEqual(10);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(0);
    });

    it("'fib-trend-extension' strokes one projected rail per FIB_LEVELS entry", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("fib-trend-extension", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "stroke").length).toBeGreaterThanOrEqual(10);
    });

    it("'fib-channel' strokes one parallel rail per FIB_LEVELS entry", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("fib-channel", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "stroke").length).toBeGreaterThanOrEqual(10);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(0);
    });

    it("'fib-time-zone' strokes vertical zones spanning the full pxHeight", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("fib-time-zone", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "stroke").length).toBeGreaterThanOrEqual(10);
        const lineTos = ctx.calls.filter((c) => c.kind === "lineTo");
        // Every lineTo lands at the bottom of the viewport.
        for (const c of lineTos) {
            if (c.kind === "lineTo") expect(c.y).toBe(VIEW.pxHeight);
        }
    });

    it("'fib-wedge' strokes rays defaulting to invinite fib yellow (#facc15)", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("fib-wedge", "create"), VIEW);
        const strokes = ctx.calls.filter((c) => c.kind === "stroke").length;
        expect(strokes).toBeGreaterThanOrEqual(10);
        const strokeStyleCall = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (strokeStyleCall?.kind === "set") expect(strokeStyleCall.value).toBe("#facc15");
    });

    it("'fib-speed-fan' strokes one ray per FIB_LEVELS entry", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("fib-speed-fan", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "stroke").length).toBeGreaterThanOrEqual(10);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(0);
    });

    it("'fib-speed-arcs' strokes one full circle per FIB_LEVELS entry", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("fib-speed-arcs", "create"), VIEW);
        const arcs = ctx.calls.filter((c) => c.kind === "arc");
        expect(arcs.length).toBeGreaterThanOrEqual(10);
        for (const a of arcs) {
            if (a.kind === "arc") expect(a.end).toBeCloseTo(Math.PI * 2);
        }
    });

    it("'fib-spiral' strokes a single chained polyline (1 stroke)", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("fib-spiral", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "lineTo").length).toBeGreaterThanOrEqual(64);
    });

    it("'fib-circles' strokes one full circle per FIB_LEVELS entry", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("fib-circles", "create"), VIEW);
        const arcs = ctx.calls.filter((c) => c.kind === "arc");
        expect(arcs.length).toBeGreaterThanOrEqual(10);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(0);
    });

    it("'fib-trend-time' strokes vertical zones spanning the full pxHeight", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("fib-trend-time", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "stroke").length).toBeGreaterThanOrEqual(10);
        const lineTos = ctx.calls.filter((c) => c.kind === "lineTo");
        for (const c of lineTos) {
            if (c.kind === "lineTo") expect(c.y).toBe(VIEW.pxHeight);
        }
    });

    it("'gann-box' strokes 10 grid lines defaulting to gann purple (#a855f7)", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("gann-box", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(10);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(0);
        const setCall = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (setCall?.kind === "set") expect(setCall.value).toBe("#a855f7");
    });

    it("'gann-square-fixed' strokes 10 grid lines (fixed pixel side)", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("gann-square-fixed", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(10);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(0);
    });

    it("'gann-square' strokes 10 grid lines spanning a 1×1 canvas-space square", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("gann-square", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(10);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(0);
    });

    it("'gann-fan' strokes 9 rays (one per GANN_FAN_RATIOS entry)", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("gann-fan", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(9);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(0);
    });

    it("'pitchfork' strokes 3 lines (median + 2 parallel handles) defaulting to pitchfork pink (#ec4899)", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("pitchfork", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(3);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(0);
        const setCall = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (setCall?.kind === "set") expect(setCall.value).toBe("#ec4899");
    });

    it("'pitchfan' strokes 3 rays from the pivot through (b, mid(b,c), c)", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("pitchfan", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(3);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(0);
    });

    it("'xabcd-pattern' strokes 1 open polyline (4 lineTo) + labels X/A/B/C/D, defaults to pattern amber #f59e0b", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("xabcd-pattern", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "lineTo")).toHaveLength(4);
        expect(ctx.calls.filter((c) => c.kind === "fillText")).toHaveLength(5);
        expect(ctx.calls.filter((c) => c.kind === "fill")).toHaveLength(0);
        const setCall = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (setCall?.kind === "set") expect(setCall.value).toBe("#f59e0b");
    });

    it("'cypher-pattern' strokes 1 open polyline (4 lineTo) + labels X/A/B/C/D", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("cypher-pattern", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "lineTo")).toHaveLength(4);
        expect(ctx.calls.filter((c) => c.kind === "fillText")).toHaveLength(5);
    });

    it("'head-and-shoulders' strokes the pivot polyline + 1 neckline (2 strokes)", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("head-and-shoulders", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(2);
        expect(ctx.calls.filter((c) => c.kind === "beginPath")).toHaveLength(2);
        expect(ctx.calls.filter((c) => c.kind === "fillText")).toHaveLength(5);
    });

    it("'abcd-pattern' strokes 1 open polyline (3 lineTo) + labels A/B/C/D", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("abcd-pattern", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "lineTo")).toHaveLength(3);
        expect(ctx.calls.filter((c) => c.kind === "fillText")).toHaveLength(4);
    });

    it("'triangle-pattern' strokes 1 open polyline (2 lineTo) + labels A/B/C", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("triangle-pattern", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "lineTo")).toHaveLength(2);
        expect(ctx.calls.filter((c) => c.kind === "fillText")).toHaveLength(3);
    });

    it("'three-drives-pattern' strokes 1 open polyline (6 lineTo) + labels S/D1/R1/D2/R2/D3/E", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("three-drives-pattern", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "lineTo")).toHaveLength(6);
        expect(ctx.calls.filter((c) => c.kind === "fillText")).toHaveLength(7);
    });

    it("'elliott-impulse-wave' strokes 1 polyline (4 lineTo) + labels 1/2/3/4/5, defaults to teal #14b8a6", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("elliott-impulse-wave", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "lineTo")).toHaveLength(4);
        expect(ctx.calls.filter((c) => c.kind === "fillText")).toHaveLength(5);
        const setCall = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (setCall?.kind === "set") expect(setCall.value).toBe("#14b8a6");
    });

    it("'elliott-correction-wave' strokes 1 polyline (2 lineTo) + labels A/B/C", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("elliott-correction-wave", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "lineTo")).toHaveLength(2);
        expect(ctx.calls.filter((c) => c.kind === "fillText")).toHaveLength(3);
    });

    it("'elliott-triangle-wave' strokes 1 polyline (4 lineTo) + labels a/b/c/d/e", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("elliott-triangle-wave", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "lineTo")).toHaveLength(4);
        expect(ctx.calls.filter((c) => c.kind === "fillText")).toHaveLength(5);
    });

    it("'elliott-double-combo' strokes 1 polyline (6 lineTo) + labels S/W/x1/X/x2/Yi/Y", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("elliott-double-combo", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "lineTo")).toHaveLength(6);
        expect(ctx.calls.filter((c) => c.kind === "fillText")).toHaveLength(7);
    });

    it("'elliott-triple-combo' strokes 1 polyline (6 lineTo) + labels S/W/X1/Y/X2/Zi/Z", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("elliott-triple-combo", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "lineTo")).toHaveLength(6);
        expect(ctx.calls.filter((c) => c.kind === "fillText")).toHaveLength(7);
    });

    it("'cyclic-lines' strokes repeated full-height vertical strokes, defaults to sky #0ea5e9", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("cyclic-lines", "create"), VIEW);
        const strokes = ctx.calls.filter((c) => c.kind === "stroke").length;
        expect(strokes).toBeGreaterThan(1);
        expect(ctx.calls.filter((c) => c.kind === "moveTo")).toHaveLength(strokes);
        expect(ctx.calls.filter((c) => c.kind === "lineTo")).toHaveLength(strokes);
        const stroke = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (stroke?.kind === "set") expect(stroke.value).toBe("#0ea5e9");
    });

    it("'time-cycles' strokes concentric arcs (1 arc per cycle), defaults to sky #0ea5e9", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("time-cycles", "create"), VIEW);
        const arcs = ctx.calls.filter((c) => c.kind === "arc").length;
        expect(arcs).toBeGreaterThan(1);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(arcs);
        const stroke = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (stroke?.kind === "set") expect(stroke.value).toBe("#0ea5e9");
    });

    it("'sine-line' strokes 1 sampled polyline (>32 lineTo), defaults to sky #0ea5e9", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("sine-line", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "moveTo")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "lineTo").length).toBeGreaterThan(32);
        const stroke = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (stroke?.kind === "set") expect(stroke.value).toBe("#0ea5e9");
    });

    it("'frame' strokes a closed rectangle + paints bg fillRect + label fillText, defaults to slate #64748b", () => {
        const ctx = new MockCanvas2DContext();
        drawingDispatch(ctx, syntheticEmission("frame", "create"), VIEW);
        expect(ctx.calls.filter((c) => c.kind === "beginPath")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "closePath")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "stroke")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "fillRect")).toHaveLength(1);
        expect(ctx.calls.filter((c) => c.kind === "fillText")).toHaveLength(1);
        const stroke = ctx.calls.find((c) => c.kind === "set" && c.prop === "strokeStyle");
        if (stroke?.kind === "set") expect(stroke.value).toBe("#64748b");
    });
});

describe("drawingDispatch — 'group' no-op + exhaustiveness", () => {
    it.each([...DRAWING_KINDS].filter((k) => !RENDERING_KINDS.has(k)))(
        "dispatches '%s' (op:create) without touching the context",
        (kind) => {
            const ctx = new MockCanvas2DContext();
            drawingDispatch(ctx, syntheticEmission(kind, "create"), VIEW);
            expect(ctx.calls).toEqual([]);
        },
    );

    it("short-circuits op:'remove' for every kind (no context touch)", () => {
        for (const kind of DRAWING_KINDS) {
            const ctx = new MockCanvas2DContext();
            drawingDispatch(ctx, syntheticEmission(kind, "remove"), VIEW);
            expect(ctx.calls).toEqual([]);
        }
    });

    it("treats op:'update' on a Task-5 kind the same way as op:'create'", () => {
        const ctxA = new MockCanvas2DContext();
        const ctxB = new MockCanvas2DContext();
        drawingDispatch(ctxA, syntheticEmission("line", "create"), VIEW);
        drawingDispatch(ctxB, syntheticEmission("line", "update"), VIEW);
        expect(ctxA.calls).toEqual(ctxB.calls);
    });

    it("falls into the exhaustive default arm for unknown kinds (defensive)", () => {
        const ctx = new MockCanvas2DContext();
        const rogue = {
            kind: "drawing",
            handleId: "synthetic#rogue",
            drawingKind: "not-a-real-kind" as unknown as DrawingKind,
            op: "create" as const,
            state: { kind: "rogue" } as unknown as DrawingState,
            bar: 0,
            time: 0,
        } satisfies DrawingEmission;
        expect(() => drawingDispatch(ctx, rogue, VIEW)).not.toThrow();
        expect(ctx.calls).toEqual([]);
    });
});
