// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawNamespace } from "@invinite-org/chartlang-core";
import { draw as CORE_DRAW_STUB } from "@invinite-org/chartlang-core";

import { arrow } from "./annotations/arrow.js";
import { arrowMarkDown } from "./annotations/arrowMarkDown.js";
import { arrowMarkUp } from "./annotations/arrowMarkUp.js";
import { arrowMarker } from "./annotations/arrowMarker.js";
import { text } from "./annotations/text.js";
import { circle } from "./boxes/circle.js";
import { ellipse } from "./boxes/ellipse.js";
import { marker } from "./boxes/marker.js";
import { path } from "./boxes/path.js";
import { polyline } from "./boxes/polyline.js";
import { rectangle } from "./boxes/rectangle.js";
import { rotatedRectangle } from "./boxes/rotatedRectangle.js";
import { triangle } from "./boxes/triangle.js";
import { disjointChannel } from "./channels/disjointChannel.js";
import { flatTopBottom } from "./channels/flatTopBottom.js";
import { regressionTrend } from "./channels/regressionTrend.js";
import { trendChannel } from "./channels/trendChannel.js";
import { frame } from "./containers/frame.js";
import { group } from "./containers/group.js";
import { arc } from "./curves/arc.js";
import { brush } from "./curves/brush.js";
import { curve } from "./curves/curve.js";
import { doubleCurve } from "./curves/doubleCurve.js";
import { highlighter } from "./curves/highlighter.js";
import { pen } from "./curves/pen.js";
import { cyclicLines } from "./cycles/cyclicLines.js";
import { sineLine } from "./cycles/sineLine.js";
import { timeCycles } from "./cycles/timeCycles.js";
import { elliottCorrectionWave } from "./elliott/elliottCorrectionWave.js";
import { elliottDoubleCombo } from "./elliott/elliottDoubleCombo.js";
import { elliottImpulseWave } from "./elliott/elliottImpulseWave.js";
import { elliottTriangleWave } from "./elliott/elliottTriangleWave.js";
import { elliottTripleCombo } from "./elliott/elliottTripleCombo.js";
import { fibChannel } from "./fibA/fibChannel.js";
import { fibRetracement } from "./fibA/fibRetracement.js";
import { fibTimeZone } from "./fibA/fibTimeZone.js";
import { fibTrendExtension } from "./fibA/fibTrendExtension.js";
import { fibWedge } from "./fibA/fibWedge.js";
import { fibCircles } from "./fibB/fibCircles.js";
import { fibSpeedArcs } from "./fibB/fibSpeedArcs.js";
import { fibSpeedFan } from "./fibB/fibSpeedFan.js";
import { fibSpiral } from "./fibB/fibSpiral.js";
import { fibTrendTime } from "./fibB/fibTrendTime.js";
import { gannBox } from "./gann/gannBox.js";
import { gannFan } from "./gann/gannFan.js";
import { gannSquare } from "./gann/gannSquare.js";
import { gannSquareFixed } from "./gann/gannSquareFixed.js";
import { crossLine } from "./lines/crossLine.js";
import { horizontalLine } from "./lines/horizontalLine.js";
import { horizontalRay } from "./lines/horizontalRay.js";
import { line } from "./lines/line.js";
import { trendAngle } from "./lines/trendAngle.js";
import { verticalLine } from "./lines/verticalLine.js";
import { abcdPattern } from "./patterns/abcdPattern.js";
import { cypherPattern } from "./patterns/cypherPattern.js";
import { headAndShoulders } from "./patterns/headAndShoulders.js";
import { threeDrivesPattern } from "./patterns/threeDrivesPattern.js";
import { trianglePattern } from "./patterns/trianglePattern.js";
import { xabcdPattern } from "./patterns/xabcdPattern.js";
import { pitchfan } from "./pitchforks/pitchfan.js";
import { pitchfork } from "./pitchforks/pitchfork.js";
import { table } from "./table/table.js";

const KIND_IMPLS = {
    // Task 5 — Lines/Rays
    line,
    horizontalLine,
    horizontalRay,
    verticalLine,
    crossLine,
    trendAngle,
    // Task 6 — Boxes A
    rectangle,
    rotatedRectangle,
    triangle,
    polyline,
    // Task 7 — Boxes B
    circle,
    ellipse,
    path,
    marker,
    // Task 8 — Curves
    arc,
    curve,
    doubleCurve,
    // Task 8 — Freehand
    pen,
    highlighter,
    brush,
    // Task 9 — Annotations
    text,
    arrow,
    arrowMarker,
    arrowMarkUp,
    arrowMarkDown,
    // Task 10 — Channels
    trendChannel,
    flatTopBottom,
    disjointChannel,
    regressionTrend,
    // Task 11 — Fibonacci A
    fibRetracement,
    fibTrendExtension,
    fibChannel,
    fibTimeZone,
    fibWedge,
    // Task 12 — Fibonacci B
    fibSpeedFan,
    fibSpeedArcs,
    fibSpiral,
    fibCircles,
    fibTrendTime,
    // Task 13 — Gann
    gannBox,
    gannSquareFixed,
    gannSquare,
    gannFan,
    // Task 14 — Pitchforks
    pitchfork,
    pitchfan,
    // Task 15 — Harmonic Patterns
    xabcdPattern,
    cypherPattern,
    headAndShoulders,
    abcdPattern,
    trianglePattern,
    threeDrivesPattern,
    // Task 16 — Elliott Waves
    elliottImpulseWave,
    elliottCorrectionWave,
    elliottTriangleWave,
    elliottDoubleCombo,
    elliottTripleCombo,
    // Task 17 — Cycles
    cyclicLines,
    timeCycles,
    sineLine,
    // Task 18 — Containers
    group,
    frame,
    // Phase 5 — Viewport overlays
    table,
} as const;

const IMPL_KIND_NAMES: ReadonlySet<string> = new Set(Object.keys(KIND_IMPLS));

/**
 * Runtime `draw` namespace. After Task 18 every one of the 61
 * `DrawingKind`s has a real per-kind impl wired into `KIND_IMPLS`;
 * Phase 5 adds the viewport-anchored `table` kind.
 * the Proxy's `else` branch (fall-through to the core throwing-stub
 * Proxy) is dead code at runtime — kept as defence-in-depth for
 * unknown property access (e.g. JS code accessing a property name
 * outside the `DrawNamespace` type surface).
 *
 * Each per-kind impl is the compiler-injected overload — the
 * dispatch branches on `typeof arg1 === "string"` to discriminate the
 * slot-id-prefixed compiler form from the bare script-facing form
 * which always throws. This is the Phase-3 swap seam for the
 * `primitives.ts:draw` re-export, mirroring how `TA_REGISTRY` swaps
 * in Phase 2 (PLAN.md §5.5).
 *
 * @since 0.3
 * @stable
 * @example
 *     import { draw } from "@invinite-org/chartlang-runtime";
 *     // type S = typeof draw;
 *     void draw;
 */
export const DRAW_NAMESPACE: DrawNamespace = new Proxy(KIND_IMPLS as unknown as DrawNamespace, {
    get(target, property): unknown {
        const name = String(property);
        if (IMPL_KIND_NAMES.has(name)) {
            return Reflect.get(target, property);
        }
        // After Task 18 every `DrawingKind` has a real impl in
        // `KIND_IMPLS` so this branch is unreachable through the
        // `DrawNamespace` type surface — it stays as defence-in-depth
        // for non-kind property access (e.g. JS code that reads
        // `draw["foo"]` through a typed-erased view). Falling through
        // to core's throwing-stub keeps the failure mode consistent
        // with the pre-Task-18 behaviour.
        return Reflect.get(CORE_DRAW_STUB, property);
    },
});
