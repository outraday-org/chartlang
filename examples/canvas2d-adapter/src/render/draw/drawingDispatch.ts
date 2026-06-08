// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";

import type { RenderCtx } from "../clear";
import type { Viewport } from "../coords";
import { renderAbcdPattern } from "./abcdPattern";
import { renderArc } from "./arc";
import { renderArrow } from "./arrow";
import { renderArrowMarkDown } from "./arrowMarkDown";
import { renderArrowMarkUp } from "./arrowMarkUp";
import { renderArrowMarker } from "./arrowMarker";
import { renderBrush } from "./brush";
import { renderCircle } from "./circle";
import { renderCrossLine } from "./crossLine";
import { renderCurve } from "./curve";
import { renderCyclicLines } from "./cyclicLines";
import { renderCypherPattern } from "./cypherPattern";
import { renderDisjointChannel } from "./disjointChannel";
import { renderDoubleCurve } from "./doubleCurve";
import { renderElliottCorrectionWave } from "./elliottCorrectionWave";
import { renderElliottDoubleCombo } from "./elliottDoubleCombo";
import { renderElliottImpulseWave } from "./elliottImpulseWave";
import { renderElliottTriangleWave } from "./elliottTriangleWave";
import { renderElliottTripleCombo } from "./elliottTripleCombo";
import { renderEllipse } from "./ellipse";
import { renderFibChannel } from "./fibChannel";
import { renderFibCircles } from "./fibCircles";
import { renderFibRetracement } from "./fibRetracement";
import { renderFibSpeedArcs } from "./fibSpeedArcs";
import { renderFibSpeedFan } from "./fibSpeedFan";
import { renderFibSpiral } from "./fibSpiral";
import { renderFibTimeZone } from "./fibTimeZone";
import { renderFibTrendExtension } from "./fibTrendExtension";
import { renderFibTrendTime } from "./fibTrendTime";
import { renderFibWedge } from "./fibWedge";
import { renderFlatTopBottom } from "./flatTopBottom";
import { renderFrame } from "./frame";
import { renderGroup } from "./group";
import { renderGannBox } from "./gannBox";
import { renderGannFan } from "./gannFan";
import { renderGannSquare } from "./gannSquare";
import { renderGannSquareFixed } from "./gannSquareFixed";
import { renderHeadAndShoulders } from "./headAndShoulders";
import { renderHighlighter } from "./highlighter";
import { renderHorizontalLine } from "./horizontalLine";
import { renderHorizontalRay } from "./horizontalRay";
import { renderLine } from "./line";
import { renderMarker } from "./marker";
import { renderPath } from "./path";
import { renderPen } from "./pen";
import { renderPitchfan } from "./pitchfan";
import { renderPitchfork } from "./pitchfork";
import { renderPolyline } from "./polyline";
import { renderRectangle } from "./rectangle";
import { renderRegressionTrend } from "./regressionTrend";
import { renderRotatedRectangle } from "./rotatedRectangle";
import { renderSineLine } from "./sineLine";
import { renderText } from "./text";
import { renderThreeDrivesPattern } from "./threeDrivesPattern";
import { renderTimeCycles } from "./timeCycles";
import { renderTrendChannel } from "./trendChannel";
import { renderTriangle } from "./triangle";
import { renderTrianglePattern } from "./trianglePattern";
import { renderTrendAngle } from "./trendAngle";
import { renderVerticalLine } from "./verticalLine";
import { renderXabcdPattern } from "./xabcdPattern";

/**
 * Route a {@link DrawingEmission} to its per-kind renderer. The switch
 * lives in this one file so TypeScript exhaustiveness (`satisfies
 * never` default arm) covers every {@link DrawingKind} at compile time;
 * any new kind added to the union forces this file to grow a case
 * arm or the build fails.
 *
 * Task 4 shipped no-op stubs for all 61 kinds — Tasks 5–18 replaced
 * their kind arms with `renderXxx(ctx, emission, view)` calls to
 * their per-kind renderer. After Task 18 all 61 arms route to a real
 * renderer; the `group` arm routes to a pure no-op `renderGroup` per
 * the Phase-3 `Viewport` contract (no `drawingsById` field — the
 * bounding-box-of-children envelope is a Phase-4 follow-up).
 * `op: "remove"` is always a no-op render
 * (canvas2d is stateless — the next frame won't include the removed
 * drawing because the adapter's `state.drawings` map will have dropped
 * it). The renderer also does not need to clear because the adapter's
 * `clear` call at the start of every frame wipes the canvas.
 *
 * @since 0.3
 * @experimental
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const view: Viewport;
 *     declare const emission: DrawingEmission;
 *     drawingDispatch(ctx, emission, view);
 *     void drawingDispatch;
 */
export function drawingDispatch(ctx: RenderCtx, emission: DrawingEmission, view: Viewport): void {
    if (emission.op === "remove") return;
    switch (emission.drawingKind) {
        // Lines / Rays (Task 5)
        case "line":
            renderLine(ctx, emission, view);
            return;
        case "horizontal-line":
            renderHorizontalLine(ctx, emission, view);
            return;
        case "horizontal-ray":
            renderHorizontalRay(ctx, emission, view);
            return;
        case "vertical-line":
            renderVerticalLine(ctx, emission, view);
            return;
        case "cross-line":
            renderCrossLine(ctx, emission, view);
            return;
        case "trend-angle":
            renderTrendAngle(ctx, emission, view);
            return;
        // Boxes A (Task 6)
        case "rectangle":
            renderRectangle(ctx, emission, view);
            return;
        case "rotated-rectangle":
            renderRotatedRectangle(ctx, emission, view);
            return;
        case "triangle":
            renderTriangle(ctx, emission, view);
            return;
        case "polyline":
            renderPolyline(ctx, emission, view);
            return;
        // Boxes B (Task 7)
        case "circle":
            renderCircle(ctx, emission, view);
            return;
        case "ellipse":
            renderEllipse(ctx, emission, view);
            return;
        case "path":
            renderPath(ctx, emission, view);
            return;
        case "marker":
            renderMarker(ctx, emission, view);
            return;
        // Curves (Task 8)
        case "arc":
            renderArc(ctx, emission, view);
            return;
        case "curve":
            renderCurve(ctx, emission, view);
            return;
        case "double-curve":
            renderDoubleCurve(ctx, emission, view);
            return;
        // Freehand (Task 8)
        case "pen":
            renderPen(ctx, emission, view);
            return;
        case "highlighter":
            renderHighlighter(ctx, emission, view);
            return;
        case "brush":
            renderBrush(ctx, emission, view);
            return;
        // Annotations (Task 9)
        case "text":
            renderText(ctx, emission, view);
            return;
        case "arrow":
            renderArrow(ctx, emission, view);
            return;
        case "arrow-marker":
            renderArrowMarker(ctx, emission, view);
            return;
        case "arrow-mark-up":
            renderArrowMarkUp(ctx, emission, view);
            return;
        case "arrow-mark-down":
            renderArrowMarkDown(ctx, emission, view);
            return;
        // Channels (Task 10)
        case "trend-channel":
            renderTrendChannel(ctx, emission, view);
            return;
        case "flat-top-bottom":
            renderFlatTopBottom(ctx, emission, view);
            return;
        case "disjoint-channel":
            renderDisjointChannel(ctx, emission, view);
            return;
        case "regression-trend":
            renderRegressionTrend(ctx, emission, view);
            return;
        // Fibonacci A (Task 11)
        case "fib-retracement":
            renderFibRetracement(ctx, emission, view);
            return;
        case "fib-trend-extension":
            renderFibTrendExtension(ctx, emission, view);
            return;
        case "fib-channel":
            renderFibChannel(ctx, emission, view);
            return;
        case "fib-time-zone":
            renderFibTimeZone(ctx, emission, view);
            return;
        case "fib-wedge":
            renderFibWedge(ctx, emission, view);
            return;
        // Fibonacci B (Task 12)
        case "fib-speed-fan":
            renderFibSpeedFan(ctx, emission, view);
            return;
        case "fib-speed-arcs":
            renderFibSpeedArcs(ctx, emission, view);
            return;
        case "fib-spiral":
            renderFibSpiral(ctx, emission, view);
            return;
        case "fib-circles":
            renderFibCircles(ctx, emission, view);
            return;
        case "fib-trend-time":
            renderFibTrendTime(ctx, emission, view);
            return;
        // Gann (Task 13)
        case "gann-box":
            renderGannBox(ctx, emission, view);
            return;
        case "gann-square-fixed":
            renderGannSquareFixed(ctx, emission, view);
            return;
        case "gann-square":
            renderGannSquare(ctx, emission, view);
            return;
        case "gann-fan":
            renderGannFan(ctx, emission, view);
            return;
        // Pitchforks (Task 14)
        case "pitchfork":
            renderPitchfork(ctx, emission, view);
            return;
        case "pitchfan":
            renderPitchfan(ctx, emission, view);
            return;
        // Harmonic patterns (Task 15)
        case "xabcd-pattern":
            renderXabcdPattern(ctx, emission, view);
            return;
        case "cypher-pattern":
            renderCypherPattern(ctx, emission, view);
            return;
        case "head-and-shoulders":
            renderHeadAndShoulders(ctx, emission, view);
            return;
        case "abcd-pattern":
            renderAbcdPattern(ctx, emission, view);
            return;
        case "triangle-pattern":
            renderTrianglePattern(ctx, emission, view);
            return;
        case "three-drives-pattern":
            renderThreeDrivesPattern(ctx, emission, view);
            return;
        // Elliott waves (Task 16)
        case "elliott-impulse-wave":
            renderElliottImpulseWave(ctx, emission, view);
            return;
        case "elliott-correction-wave":
            renderElliottCorrectionWave(ctx, emission, view);
            return;
        case "elliott-triangle-wave":
            renderElliottTriangleWave(ctx, emission, view);
            return;
        case "elliott-double-combo":
            renderElliottDoubleCombo(ctx, emission, view);
            return;
        case "elliott-triple-combo":
            renderElliottTripleCombo(ctx, emission, view);
            return;
        // Cycles (Task 17)
        case "cyclic-lines":
            renderCyclicLines(ctx, emission, view);
            return;
        case "time-cycles":
            renderTimeCycles(ctx, emission, view);
            return;
        case "sine-line":
            renderSineLine(ctx, emission, view);
            return;
        // Containers (Task 18)
        case "group":
            renderGroup(ctx, emission, view);
            return;
        case "frame":
            renderFrame(ctx, emission, view);
            return;
        default: {
            const _exhaustive: never = emission.drawingKind;
            void _exhaustive;
            void ctx;
            void view;
            return;
        }
    }
}
