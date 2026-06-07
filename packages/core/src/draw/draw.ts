// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Price, Time } from "../types";
import type {
    ArrowMarkerOpts,
    ArrowOpts,
    BrushStyle,
    FibOpts,
    FrameOpts,
    HighlighterStyle,
    LineDrawStyle,
    PathOpts,
    RegressionTrendOpts,
    ShapeStyle,
    TextOpts,
} from "./drawingStyle";
import type { DrawingHandle } from "./handle";
import type {
    AnchorHept,
    AnchorQuad,
    AnchorQuint,
    AnchorTriple,
    WorldPoint,
} from "./worldPoint";

/**
 * The script-facing `draw.*` namespace. Each method is stateful across
 * calls — the compiler injects a callsite slot id so the runtime can
 * track the per-handle `DrawingState` across bars — and returns a
 * {@link DrawingHandle}. Adapters that omit a kind degrade silently
 * with `unsupported-drawing-kind` (PLAN.md §7.4); excess emissions
 * drop with `drawing-budget-exceeded` once the per-script bucket is
 * full.
 *
 * Every kind lives as a FLAT method directly on `DrawNamespace` —
 * script authors call `draw.fibRetracement(a, b)` /
 * `draw.gannBox(a, b)` / `draw.elliottImpulseWave(anchors)` /
 * `draw.xabcdPattern(anchors)`, matching the flat camelCase names in
 * `STATEFUL_PRIMITIVES` and Pine + invinite parity. The wire format
 * keeps the kebab-case `DrawingKind`.
 *
 * Phase-3 implementations live in `@invinite-org/chartlang-runtime`;
 * this file ships the script-author type plus a throwing-stub `draw`
 * value (mirrors `plot/plot.ts:plot`). Tasks 5–18 land the runtime
 * impl per category.
 *
 * @formula  N/A — namespace surface; per-method runtime impl in Tasks 5–18
 * @anchors  per-method — see the per-kind state shapes in `drawingState.ts`
 * @since 0.3
 * @experimental
 * @example
 *     import type { DrawNamespace } from "@invinite-org/chartlang-core";
 *     const _ns: DrawNamespace | null = null;
 *     void _ns;
 */
export type DrawNamespace = {
    // Lines / Rays (Task 5)
    line(a: WorldPoint, b: WorldPoint, opts?: LineDrawStyle): DrawingHandle;
    horizontalLine(price: Price, opts?: LineDrawStyle): DrawingHandle;
    horizontalRay(anchor: WorldPoint, opts?: LineDrawStyle): DrawingHandle;
    verticalLine(time: Time, opts?: LineDrawStyle): DrawingHandle;
    crossLine(anchor: WorldPoint, opts?: LineDrawStyle): DrawingHandle;
    trendAngle(a: WorldPoint, b: WorldPoint, opts?: LineDrawStyle): DrawingHandle;
    // Boxes A (Task 6)
    rectangle(a: WorldPoint, b: WorldPoint, opts?: ShapeStyle): DrawingHandle;
    rotatedRectangle(anchors: AnchorQuad, opts?: ShapeStyle): DrawingHandle;
    triangle(anchors: AnchorTriple, opts?: ShapeStyle): DrawingHandle;
    polyline(anchors: ReadonlyArray<WorldPoint>, opts?: LineDrawStyle): DrawingHandle;
    // Boxes B (Task 7)
    circle(centre: WorldPoint, radiusAnchor: WorldPoint, opts?: ShapeStyle): DrawingHandle;
    ellipse(a: WorldPoint, b: WorldPoint, opts?: ShapeStyle): DrawingHandle;
    path(anchors: ReadonlyArray<WorldPoint>, opts?: PathOpts): DrawingHandle;
    marker(
        anchor: WorldPoint,
        opts?: TextOpts & { readonly text?: string; readonly value?: number },
    ): DrawingHandle;
    // Curves (Task 8)
    arc(anchors: AnchorTriple, opts?: LineDrawStyle): DrawingHandle;
    curve(anchors: AnchorTriple, opts?: LineDrawStyle): DrawingHandle;
    doubleCurve(anchors: AnchorQuint, opts?: LineDrawStyle): DrawingHandle;
    // Freehand (Task 8)
    pen(anchors: ReadonlyArray<WorldPoint>, opts?: LineDrawStyle): DrawingHandle;
    highlighter(anchors: ReadonlyArray<WorldPoint>, opts: HighlighterStyle): DrawingHandle;
    brush(anchors: ReadonlyArray<WorldPoint>, opts: BrushStyle): DrawingHandle;
    // Annotations (Task 9)
    text(anchor: WorldPoint, body: string, opts?: TextOpts): DrawingHandle;
    arrow(a: WorldPoint, b: WorldPoint, opts?: ArrowOpts): DrawingHandle;
    arrowMarker(anchor: WorldPoint, opts?: ArrowMarkerOpts): DrawingHandle;
    arrowMarkUp(anchor: WorldPoint, opts?: ArrowMarkerOpts): DrawingHandle;
    arrowMarkDown(anchor: WorldPoint, opts?: ArrowMarkerOpts): DrawingHandle;
    // Channels (Task 10)
    trendChannel(anchors: AnchorTriple, opts?: LineDrawStyle): DrawingHandle;
    flatTopBottom(anchors: AnchorTriple, opts?: LineDrawStyle): DrawingHandle;
    disjointChannel(anchors: AnchorQuad, opts?: LineDrawStyle): DrawingHandle;
    regressionTrend(a: WorldPoint, b: WorldPoint, opts?: RegressionTrendOpts): DrawingHandle;
    // Fibonacci A (Task 11)
    fibRetracement(a: WorldPoint, b: WorldPoint, opts?: FibOpts): DrawingHandle;
    fibTrendExtension(anchors: AnchorTriple, opts?: FibOpts): DrawingHandle;
    fibChannel(anchors: AnchorTriple, opts?: FibOpts): DrawingHandle;
    fibTimeZone(a: WorldPoint, b: WorldPoint, opts?: FibOpts): DrawingHandle;
    fibWedge(anchors: AnchorTriple, opts?: FibOpts): DrawingHandle;
    // Fibonacci B (Task 12)
    fibSpeedFan(a: WorldPoint, b: WorldPoint, opts?: FibOpts): DrawingHandle;
    fibSpeedArcs(a: WorldPoint, b: WorldPoint, opts?: FibOpts): DrawingHandle;
    fibSpiral(a: WorldPoint, b: WorldPoint, opts?: FibOpts): DrawingHandle;
    fibCircles(a: WorldPoint, b: WorldPoint, opts?: FibOpts): DrawingHandle;
    fibTrendTime(anchors: AnchorTriple, opts?: FibOpts): DrawingHandle;
    // Gann (Task 13)
    gannBox(a: WorldPoint, b: WorldPoint, opts?: LineDrawStyle): DrawingHandle;
    gannSquareFixed(anchor: WorldPoint, opts?: LineDrawStyle): DrawingHandle;
    gannSquare(a: WorldPoint, b: WorldPoint, opts?: LineDrawStyle): DrawingHandle;
    gannFan(a: WorldPoint, b: WorldPoint, opts?: LineDrawStyle): DrawingHandle;
    // Pitchforks (Task 14)
    pitchfork(
        anchors: AnchorTriple,
        opts?: LineDrawStyle & {
            readonly variant?: "standard" | "schiff" | "modifiedSchiff" | "inside";
        },
    ): DrawingHandle;
    pitchfan(anchors: AnchorTriple, opts?: LineDrawStyle): DrawingHandle;
    // Harmonic Patterns (Task 15)
    xabcdPattern(anchors: AnchorQuint, opts?: LineDrawStyle): DrawingHandle;
    cypherPattern(anchors: AnchorQuint, opts?: LineDrawStyle): DrawingHandle;
    headAndShoulders(anchors: AnchorQuint, opts?: LineDrawStyle): DrawingHandle;
    abcdPattern(anchors: AnchorQuad, opts?: LineDrawStyle): DrawingHandle;
    trianglePattern(anchors: AnchorTriple, opts?: LineDrawStyle): DrawingHandle;
    threeDrivesPattern(anchors: AnchorHept, opts?: LineDrawStyle): DrawingHandle;
    // Elliott Waves (Task 16)
    elliottImpulseWave(anchors: AnchorQuint, opts?: LineDrawStyle): DrawingHandle;
    elliottCorrectionWave(anchors: AnchorTriple, opts?: LineDrawStyle): DrawingHandle;
    elliottTriangleWave(anchors: AnchorQuint, opts?: LineDrawStyle): DrawingHandle;
    elliottDoubleCombo(anchors: AnchorHept, opts?: LineDrawStyle): DrawingHandle;
    elliottTripleCombo(anchors: AnchorHept, opts?: LineDrawStyle): DrawingHandle;
    // Cycles (Task 17)
    cyclicLines(a: WorldPoint, b: WorldPoint, opts?: LineDrawStyle): DrawingHandle;
    timeCycles(a: WorldPoint, b: WorldPoint, opts?: LineDrawStyle): DrawingHandle;
    sineLine(a: WorldPoint, b: WorldPoint, opts?: LineDrawStyle): DrawingHandle;
    // Containers (Task 18)
    group(childHandleIds: ReadonlyArray<string>): DrawingHandle;
    frame(a: WorldPoint, b: WorldPoint, opts?: FrameOpts): DrawingHandle;
};

/**
 * Compile-time callable hole for the `draw.*` namespace. Every `get`
 * on the proxy returns a function that throws the
 * `"draw.<method> called outside compiled runtime"` sentinel — same
 * convention as the `plot` / `hline` / `alert` stubs in
 * `plot/plot.ts:plot` / `alert/alert.ts:alert`. The runtime swaps this
 * stub for the real namespace at boot per the
 * `@invinite-org/chartlang-runtime` `primitives.ts` seam (PLAN.md
 * §5.5).
 *
 * @formula  N/A — namespace surface; per-method runtime impl in Tasks 5–18
 * @anchors  per-method — see the per-kind state shapes in `drawingState.ts`
 * @since 0.3
 * @experimental
 * @example
 *     import { draw } from "@invinite-org/chartlang-core";
 *     try {
 *         draw.horizontalLine(0);
 *     } catch {
 *         // expected: "draw.horizontalLine called outside compiled runtime"
 *     }
 */
export const draw: DrawNamespace = createDrawStub();

function createDrawStub(): DrawNamespace {
    const handler: ProxyHandler<DrawNamespace> = {
        get(_target, property): unknown {
            const name = String(property);
            return throwingMethod(`draw.${name}`);
        },
    };
    return new Proxy({} as DrawNamespace, handler);
}

function throwingMethod(qualified: string): () => never {
    return (): never => {
        throw new Error(`${qualified} called outside compiled runtime`);
    };
}
