// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawNamespace } from "@invinite-org/chartlang-core";
import { draw as CORE_DRAW_STUB } from "@invinite-org/chartlang-core";

import { arrow } from "./annotations/arrow";
import { arrowMarkDown } from "./annotations/arrowMarkDown";
import { arrowMarkUp } from "./annotations/arrowMarkUp";
import { arrowMarker } from "./annotations/arrowMarker";
import { text } from "./annotations/text";
import { circle } from "./boxes/circle";
import { ellipse } from "./boxes/ellipse";
import { marker } from "./boxes/marker";
import { path } from "./boxes/path";
import { polyline } from "./boxes/polyline";
import { rectangle } from "./boxes/rectangle";
import { rotatedRectangle } from "./boxes/rotatedRectangle";
import { triangle } from "./boxes/triangle";
import { disjointChannel } from "./channels/disjointChannel";
import { flatTopBottom } from "./channels/flatTopBottom";
import { regressionTrend } from "./channels/regressionTrend";
import { trendChannel } from "./channels/trendChannel";
import { frame } from "./containers/frame";
import { group } from "./containers/group";
import { cyclicLines } from "./cycles/cyclicLines";
import { sineLine } from "./cycles/sineLine";
import { timeCycles } from "./cycles/timeCycles";
import { arc } from "./curves/arc";
import { brush } from "./curves/brush";
import { curve } from "./curves/curve";
import { doubleCurve } from "./curves/doubleCurve";
import { highlighter } from "./curves/highlighter";
import { pen } from "./curves/pen";
import { elliottCorrectionWave } from "./elliott/elliottCorrectionWave";
import { elliottDoubleCombo } from "./elliott/elliottDoubleCombo";
import { elliottImpulseWave } from "./elliott/elliottImpulseWave";
import { elliottTriangleWave } from "./elliott/elliottTriangleWave";
import { elliottTripleCombo } from "./elliott/elliottTripleCombo";
import { fibChannel } from "./fibA/fibChannel";
import { fibRetracement } from "./fibA/fibRetracement";
import { fibTimeZone } from "./fibA/fibTimeZone";
import { fibTrendExtension } from "./fibA/fibTrendExtension";
import { fibWedge } from "./fibA/fibWedge";
import { fibCircles } from "./fibB/fibCircles";
import { fibSpeedArcs } from "./fibB/fibSpeedArcs";
import { fibSpeedFan } from "./fibB/fibSpeedFan";
import { fibSpiral } from "./fibB/fibSpiral";
import { fibTrendTime } from "./fibB/fibTrendTime";
import { gannBox } from "./gann/gannBox";
import { gannFan } from "./gann/gannFan";
import { gannSquare } from "./gann/gannSquare";
import { gannSquareFixed } from "./gann/gannSquareFixed";
import { crossLine } from "./lines/crossLine";
import { horizontalLine } from "./lines/horizontalLine";
import { horizontalRay } from "./lines/horizontalRay";
import { line } from "./lines/line";
import { trendAngle } from "./lines/trendAngle";
import { verticalLine } from "./lines/verticalLine";
import { pitchfan } from "./pitchforks/pitchfan";
import { pitchfork } from "./pitchforks/pitchfork";
import { abcdPattern } from "./patterns/abcdPattern";
import { cypherPattern } from "./patterns/cypherPattern";
import { headAndShoulders } from "./patterns/headAndShoulders";
import { threeDrivesPattern } from "./patterns/threeDrivesPattern";
import { trianglePattern } from "./patterns/trianglePattern";
import { xabcdPattern } from "./patterns/xabcdPattern";

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
} as const;

const IMPL_KIND_NAMES: ReadonlySet<string> = new Set(Object.keys(KIND_IMPLS));

/**
 * Runtime `draw` namespace. After Task 18 every one of the 61
 * `DrawingKind`s has a real per-kind impl wired into `KIND_IMPLS`;
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
 * @experimental
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
