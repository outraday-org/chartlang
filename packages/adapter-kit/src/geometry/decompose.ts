// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    AbcdPatternState,
    ArcState,
    ArrowMarkDownState,
    ArrowMarkUpState,
    ArrowMarkerState,
    ArrowState,
    BrushState,
    CircleState,
    CrossLineState,
    CurveState,
    CyclicLinesState,
    CypherPatternState,
    DisjointChannelState,
    DoubleCurveState,
    ElliottCorrectionWaveState,
    ElliottDoubleComboState,
    ElliottImpulseWaveState,
    ElliottTriangleWaveState,
    ElliottTripleComboState,
    EllipseState,
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
    FillBetweenState,
    FlatTopBottomState,
    FrameState,
    GannBoxState,
    GannFanState,
    GannSquareFixedState,
    GannSquareState,
    GroupState,
    HeadAndShouldersState,
    HighlighterState,
    HorizontalLineState,
    HorizontalRayState,
    LineState,
    MarkerState,
    PathState,
    PenState,
    PitchfanState,
    PitchforkState,
    PolylineState,
    RectangleState,
    RegressionTrendState,
    RotatedRectangleState,
    SineLineState,
    TableState,
    TextState,
    ThreeDrivesPatternState,
    TimeCyclesState,
    TrendAngleState,
    TrendChannelState,
    TrianglePatternState,
    TriangleState,
    VerticalLineState,
    XabcdPatternState,
} from "@invinite-org/chartlang-core";

import type { DrawingEmission } from "../types.js";
import {
    decomposeArrow,
    decomposeArrowMarkDown,
    decomposeArrowMarkUp,
    decomposeArrowMarker,
    decomposeText,
} from "./kinds/annotations.js";
import {
    decomposeCircle,
    decomposeEllipse,
    decomposeFillBetween,
    decomposePath,
    decomposePolyline,
    decomposeRectangle,
    decomposeRotatedRectangle,
    decomposeTriangle,
} from "./kinds/boxes.js";
import {
    decomposeDisjointChannel,
    decomposeFlatTopBottom,
    decomposeRegressionTrend,
    decomposeTrendChannel,
} from "./kinds/channels.js";
import { decomposeFrame, decomposeGroup, decomposeTable } from "./kinds/containers.js";
import { decomposeArc, decomposeCurve, decomposeDoubleCurve } from "./kinds/curves.js";
import { decomposeCyclicLines, decomposeSineLine, decomposeTimeCycles } from "./kinds/cycles.js";
import {
    decomposeElliottCorrectionWave,
    decomposeElliottDoubleCombo,
    decomposeElliottImpulseWave,
    decomposeElliottTriangleWave,
    decomposeElliottTripleCombo,
} from "./kinds/elliott.js";
import {
    decomposeFibChannel,
    decomposeFibCircles,
    decomposeFibRetracement,
    decomposeFibSpeedArcs,
    decomposeFibSpeedFan,
    decomposeFibSpiral,
    decomposeFibTimeZone,
    decomposeFibTrendExtension,
    decomposeFibTrendTime,
    decomposeFibWedge,
} from "./kinds/fibonacci.js";
import { decomposeBrush, decomposeHighlighter, decomposePen } from "./kinds/freehand.js";
import {
    decomposeGannBox,
    decomposeGannFan,
    decomposeGannSquare,
    decomposeGannSquareFixed,
} from "./kinds/gann.js";
import {
    decomposeCrossLine,
    decomposeHorizontalLine,
    decomposeHorizontalRay,
    decomposeLine,
    decomposeTrendAngle,
    decomposeVerticalLine,
} from "./kinds/lines.js";
import { decomposeMarker } from "./kinds/marker.js";
import {
    decomposeAbcdPattern,
    decomposeCypherPattern,
    decomposeHeadAndShoulders,
    decomposeThreeDrivesPattern,
    decomposeTrianglePattern,
    decomposeXabcdPattern,
} from "./kinds/patterns.js";
import { decomposePitchfan, decomposePitchfork } from "./kinds/pitchforks.js";
import type { DrawPrimitive, Viewport } from "./types.js";

/**
 * Reduce a {@link DrawingEmission} to a flat, renderer-agnostic
 * {@link DrawPrimitive} list against `view`. Pure — no `ctx`, no library
 * types — so every adapter shares one geometry derivation and paints
 * the result with its own sink.
 *
 * The switch is **exhaustive over all 63 `DrawingKind`s**: the 20 basic
 * kinds (Task 1), the 20 curve / freehand / channel / fibonacci kinds
 * (Task 2), and the 23 gann / pitchfork / pattern / elliott / cycle /
 * container / table kinds (Task 3). The `default` arm is a `const
 * _exhaustive: never` guard — it compiles only because every literal has
 * a `case`, so adding a future `DrawingKind` to core fails `pnpm
 * typecheck` here until a decomposer is added. `op: "remove"` is handled
 * by each adapter's drawing-state map (this function operates on whatever
 * `state` it is handed).
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const e: DrawingEmission;
 *     declare const v: Viewport;
 *     const prims = decomposeDrawing(e, v);
 *     void prims;
 */
export function decomposeDrawing(e: DrawingEmission, view: Viewport): ReadonlyArray<DrawPrimitive> {
    switch (e.drawingKind) {
        case "line":
            return decomposeLine(e.state as LineState, view);
        case "horizontal-line":
            return decomposeHorizontalLine(e.state as HorizontalLineState, view);
        case "horizontal-ray":
            return decomposeHorizontalRay(e.state as HorizontalRayState, view);
        case "vertical-line":
            return decomposeVerticalLine(e.state as VerticalLineState, view);
        case "cross-line":
            return decomposeCrossLine(e.state as CrossLineState, view);
        case "trend-angle":
            return decomposeTrendAngle(e.state as TrendAngleState, view);
        case "rectangle":
            return decomposeRectangle(e.state as RectangleState, view);
        case "rotated-rectangle":
            return decomposeRotatedRectangle(e.state as RotatedRectangleState, view);
        case "triangle":
            return decomposeTriangle(e.state as TriangleState, view);
        case "polyline":
            return decomposePolyline(e.state as PolylineState, view);
        case "circle":
            return decomposeCircle(e.state as CircleState, view);
        case "ellipse":
            return decomposeEllipse(e.state as EllipseState, view);
        case "path":
            return decomposePath(e.state as PathState, view);
        case "fill-between":
            return decomposeFillBetween(e.state as FillBetweenState, view);
        case "marker":
            return decomposeMarker(e.state as MarkerState, view);
        case "text":
            return decomposeText(e.state as TextState, view);
        case "arrow":
            return decomposeArrow(e.state as ArrowState, view);
        case "arrow-marker":
            return decomposeArrowMarker(e.state as ArrowMarkerState, view);
        case "arrow-mark-up":
            return decomposeArrowMarkUp(e.state as ArrowMarkUpState, view);
        case "arrow-mark-down":
            return decomposeArrowMarkDown(e.state as ArrowMarkDownState, view);
        case "arc":
            return decomposeArc(e.state as ArcState, view);
        case "curve":
            return decomposeCurve(e.state as CurveState, view);
        case "double-curve":
            return decomposeDoubleCurve(e.state as DoubleCurveState, view);
        case "pen":
            return decomposePen(e.state as PenState, view);
        case "highlighter":
            return decomposeHighlighter(e.state as HighlighterState, view);
        case "brush":
            return decomposeBrush(e.state as BrushState, view);
        case "trend-channel":
            return decomposeTrendChannel(e.state as TrendChannelState, view);
        case "flat-top-bottom":
            return decomposeFlatTopBottom(e.state as FlatTopBottomState, view);
        case "disjoint-channel":
            return decomposeDisjointChannel(e.state as DisjointChannelState, view);
        case "regression-trend":
            return decomposeRegressionTrend(e.state as RegressionTrendState, view);
        case "fib-retracement":
            return decomposeFibRetracement(e.state as FibRetracementState, view);
        case "fib-trend-extension":
            return decomposeFibTrendExtension(e.state as FibTrendExtensionState, view);
        case "fib-channel":
            return decomposeFibChannel(e.state as FibChannelState, view);
        case "fib-time-zone":
            return decomposeFibTimeZone(e.state as FibTimeZoneState, view);
        case "fib-wedge":
            return decomposeFibWedge(e.state as FibWedgeState, view);
        case "fib-speed-fan":
            return decomposeFibSpeedFan(e.state as FibSpeedFanState, view);
        case "fib-speed-arcs":
            return decomposeFibSpeedArcs(e.state as FibSpeedArcsState, view);
        case "fib-spiral":
            return decomposeFibSpiral(e.state as FibSpiralState, view);
        case "fib-circles":
            return decomposeFibCircles(e.state as FibCirclesState, view);
        case "fib-trend-time":
            return decomposeFibTrendTime(e.state as FibTrendTimeState, view);
        case "gann-box":
            return decomposeGannBox(e.state as GannBoxState, view);
        case "gann-square-fixed":
            return decomposeGannSquareFixed(e.state as GannSquareFixedState, view);
        case "gann-square":
            return decomposeGannSquare(e.state as GannSquareState, view);
        case "gann-fan":
            return decomposeGannFan(e.state as GannFanState, view);
        case "pitchfork":
            return decomposePitchfork(e.state as PitchforkState, view);
        case "pitchfan":
            return decomposePitchfan(e.state as PitchfanState, view);
        case "xabcd-pattern":
            return decomposeXabcdPattern(e.state as XabcdPatternState, view);
        case "cypher-pattern":
            return decomposeCypherPattern(e.state as CypherPatternState, view);
        case "head-and-shoulders":
            return decomposeHeadAndShoulders(e.state as HeadAndShouldersState, view);
        case "abcd-pattern":
            return decomposeAbcdPattern(e.state as AbcdPatternState, view);
        case "triangle-pattern":
            return decomposeTrianglePattern(e.state as TrianglePatternState, view);
        case "three-drives-pattern":
            return decomposeThreeDrivesPattern(e.state as ThreeDrivesPatternState, view);
        case "elliott-impulse-wave":
            return decomposeElliottImpulseWave(e.state as ElliottImpulseWaveState, view);
        case "elliott-correction-wave":
            return decomposeElliottCorrectionWave(e.state as ElliottCorrectionWaveState, view);
        case "elliott-triangle-wave":
            return decomposeElliottTriangleWave(e.state as ElliottTriangleWaveState, view);
        case "elliott-double-combo":
            return decomposeElliottDoubleCombo(e.state as ElliottDoubleComboState, view);
        case "elliott-triple-combo":
            return decomposeElliottTripleCombo(e.state as ElliottTripleComboState, view);
        case "cyclic-lines":
            return decomposeCyclicLines(e.state as CyclicLinesState, view);
        case "time-cycles":
            return decomposeTimeCycles(e.state as TimeCyclesState, view);
        case "sine-line":
            return decomposeSineLine(e.state as SineLineState, view);
        case "group":
            return decomposeGroup(e.state as GroupState, view);
        case "frame":
            return decomposeFrame(e.state as FrameState, view);
        case "table":
            return decomposeTable(e.state as TableState, view);
        default: {
            const _exhaustive: never = e.drawingKind;
            void _exhaustive;
            return [];
        }
    }
}
