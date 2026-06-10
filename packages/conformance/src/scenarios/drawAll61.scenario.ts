// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

// Smoke scenario for Task 19 — emits ONE of every `DrawingKind` (61
// total) in a single script on the first bar. Anchors are hardcoded
// deterministic literals (not derived from the goldenBars fixture) so
// the pinned `drawing-hash` survives fixture re-seeding. Per the
// PLAN.md §10 / README §22.10 contract:
//
// - All 61 kinds resolve through `pushDrawing`'s happy path (no kind
//   drops with `unsupported-drawing-kind`).
// - Per-bucket counts fit under the canvas2d / TEST_CAPABILITIES caps
//   (`{ lines: 100..200, labels: 100..200, boxes: 100, polylines: 100,
//   other: 100 }`); no `drawing-budget-exceeded`.
// - `pitchfork` carries `variant: "schiff"` per the spec — exercises
//   the non-default variant path.
// - `path` (open polyline) and `polyline` (closed polyline at the
//   renderer) coexist on the wire.
//
// Anchor convention: `T0 = 1_700_000_000_000` (= `goldenBars[0].time`);
// `STEP = 60_000` (= one bar). Anchors fan across `t(0)..t(120)` so the
// renderer sees visually distinct positions per kind while keeping the
// script body compact and readable.
const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw-all-61 smoke",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            // Lines / Rays (6).
            draw.line({ time: 1_700_000_000_000, price: 100 }, { time: 1_700_000_060_000, price: 110 });
            draw.horizontalLine(105);
            draw.horizontalRay({ time: 1_700_000_000_000, price: 95 });
            draw.verticalLine(1_700_000_120_000);
            draw.crossLine({ time: 1_700_000_180_000, price: 100 });
            draw.trendAngle({ time: 1_700_000_000_000, price: 100 }, { time: 1_700_000_060_000, price: 120 });
            // Boxes / Shapes (8).
            draw.rectangle({ time: 1_700_000_000_000, price: 100 }, { time: 1_700_000_060_000, price: 110 });
            draw.rotatedRectangle([
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_060_000, price: 110 },
                { time: 1_700_000_120_000, price: 100 },
                { time: 1_700_000_060_000, price: 90 },
            ]);
            draw.triangle([
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_060_000, price: 120 },
                { time: 1_700_000_120_000, price: 100 },
            ]);
            draw.polyline([
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_060_000, price: 110 },
                { time: 1_700_000_120_000, price: 105 },
            ]);
            draw.circle({ time: 1_700_000_000_000, price: 100 }, { time: 1_700_000_060_000, price: 105 });
            draw.ellipse({ time: 1_700_000_000_000, price: 90 }, { time: 1_700_000_120_000, price: 110 });
            draw.path([
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_060_000, price: 105 },
                { time: 1_700_000_120_000, price: 110 },
            ]);
            draw.marker({ time: 1_700_000_000_000, price: 100 }, { text: "M", size: "large" });
            // Curves (3).
            draw.arc([
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_060_000, price: 120 },
                { time: 1_700_000_120_000, price: 100 },
            ]);
            draw.curve([
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_060_000, price: 130 },
                { time: 1_700_000_120_000, price: 100 },
            ]);
            draw.doubleCurve([
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_030_000, price: 130 },
                { time: 1_700_000_060_000, price: 100 },
                { time: 1_700_000_090_000, price: 70 },
                { time: 1_700_000_120_000, price: 100 },
            ]);
            // Freehand (3).
            draw.pen([
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_060_000, price: 110 },
                { time: 1_700_000_120_000, price: 105 },
            ]);
            draw.highlighter(
                [
                    { time: 1_700_000_000_000, price: 100 },
                    { time: 1_700_000_060_000, price: 110 },
                    { time: 1_700_000_120_000, price: 105 },
                ],
                { color: "#facc15", alpha: 0.3 },
            );
            draw.brush(
                [
                    { time: 1_700_000_000_000, price: 100 },
                    { time: 1_700_000_060_000, price: 120 },
                    { time: 1_700_000_120_000, price: 100 },
                    { time: 1_700_000_180_000, price: 80 },
                ],
                { stroke: "#000000", fill: "#dbeafe" },
            );
            // Annotations (5).
            draw.text({ time: 1_700_000_000_000, price: 100 }, "All 61");
            draw.arrow({ time: 1_700_000_000_000, price: 105 }, { time: 1_700_000_060_000, price: 115 });
            draw.arrowMarker({ time: 1_700_000_060_000, price: 100 });
            draw.arrowMarkUp({ time: 1_700_000_120_000, price: 95 });
            draw.arrowMarkDown({ time: 1_700_000_120_000, price: 120 });
            // Channels (4).
            draw.trendChannel([
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_060_000, price: 120 },
                { time: 1_700_000_000_000, price: 90 },
            ]);
            draw.flatTopBottom([
                { time: 1_700_000_000_000, price: 115 },
                { time: 1_700_000_060_000, price: 115 },
                { time: 1_700_000_000_000, price: 95 },
            ]);
            draw.disjointChannel([
                { time: 1_700_000_000_000, price: 80 },
                { time: 1_700_000_060_000, price: 95 },
                { time: 1_700_000_000_000, price: 70 },
                { time: 1_700_000_060_000, price: 88 },
            ]);
            draw.regressionTrend(
                { time: 1_700_000_060_000, price: 100 },
                { time: 1_700_000_120_000, price: 110 },
                { source: "close", stdevMultiplier: 2 },
            );
            // Fibonacci (10).
            draw.fibRetracement(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_060_000, price: 120 },
            );
            draw.fibTrendExtension([
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_060_000, price: 130 },
                { time: 1_700_000_120_000, price: 115 },
            ]);
            draw.fibChannel([
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_060_000, price: 120 },
                { time: 1_700_000_000_000, price: 90 },
            ]);
            draw.fibTimeZone(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_060_000, price: 100 },
            );
            draw.fibWedge([
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_060_000, price: 130 },
                { time: 1_700_000_060_000, price: 70 },
            ]);
            draw.fibSpeedFan(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_060_000, price: 120 },
            );
            draw.fibSpeedArcs(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_060_000, price: 120 },
            );
            draw.fibSpiral(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_060_000, price: 120 },
            );
            draw.fibCircles(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_060_000, price: 120 },
            );
            draw.fibTrendTime([
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_060_000, price: 130 },
                { time: 1_700_000_120_000, price: 115 },
            ]);
            // Gann (4).
            draw.gannBox(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_060_000, price: 120 },
            );
            draw.gannSquareFixed({ time: 1_700_000_000_000, price: 100 });
            draw.gannSquare(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_060_000, price: 120 },
            );
            draw.gannFan(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_060_000, price: 120 },
            );
            // Pitchforks (2).
            draw.pitchfork(
                [
                    { time: 1_700_000_000_000, price: 100 },
                    { time: 1_700_000_030_000, price: 120 },
                    { time: 1_700_000_060_000, price: 90 },
                ],
                { variant: "schiff" },
            );
            draw.pitchfan([
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_030_000, price: 120 },
                { time: 1_700_000_060_000, price: 90 },
            ]);
            // Harmonic Patterns (6).
            draw.xabcdPattern([
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_015_000, price: 120 },
                { time: 1_700_000_030_000, price: 105 },
                { time: 1_700_000_045_000, price: 135 },
                { time: 1_700_000_060_000, price: 115 },
            ]);
            draw.cypherPattern([
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_015_000, price: 130 },
                { time: 1_700_000_030_000, price: 110 },
                { time: 1_700_000_045_000, price: 145 },
                { time: 1_700_000_060_000, price: 118 },
            ]);
            draw.headAndShoulders([
                { time: 1_700_000_000_000, price: 120 },
                { time: 1_700_000_015_000, price: 100 },
                { time: 1_700_000_030_000, price: 140 },
                { time: 1_700_000_045_000, price: 100 },
                { time: 1_700_000_060_000, price: 118 },
            ]);
            draw.abcdPattern([
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_020_000, price: 120 },
                { time: 1_700_000_040_000, price: 105 },
                { time: 1_700_000_060_000, price: 130 },
            ]);
            draw.trianglePattern([
                { time: 1_700_000_060_000, price: 110 },
                { time: 1_700_000_000_000, price: 130 },
                { time: 1_700_000_000_000, price: 100 },
            ]);
            draw.threeDrivesPattern([
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_010_000, price: 115 },
                { time: 1_700_000_020_000, price: 108 },
                { time: 1_700_000_030_000, price: 125 },
                { time: 1_700_000_040_000, price: 116 },
                { time: 1_700_000_050_000, price: 135 },
                { time: 1_700_000_060_000, price: 124 },
            ]);
            // Elliott Waves (5).
            draw.elliottImpulseWave([
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_015_000, price: 120 },
                { time: 1_700_000_030_000, price: 105 },
                { time: 1_700_000_045_000, price: 135 },
                { time: 1_700_000_060_000, price: 115 },
            ]);
            draw.elliottCorrectionWave([
                { time: 1_700_000_000_000, price: 120 },
                { time: 1_700_000_030_000, price: 100 },
                { time: 1_700_000_060_000, price: 115 },
            ]);
            draw.elliottTriangleWave([
                { time: 1_700_000_000_000, price: 120 },
                { time: 1_700_000_015_000, price: 100 },
                { time: 1_700_000_030_000, price: 115 },
                { time: 1_700_000_045_000, price: 105 },
                { time: 1_700_000_060_000, price: 110 },
            ]);
            draw.elliottDoubleCombo([
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_010_000, price: 115 },
                { time: 1_700_000_020_000, price: 108 },
                { time: 1_700_000_030_000, price: 125 },
                { time: 1_700_000_040_000, price: 116 },
                { time: 1_700_000_050_000, price: 135 },
                { time: 1_700_000_060_000, price: 124 },
            ]);
            draw.elliottTripleCombo([
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_010_000, price: 118 },
                { time: 1_700_000_020_000, price: 108 },
                { time: 1_700_000_030_000, price: 128 },
                { time: 1_700_000_040_000, price: 118 },
                { time: 1_700_000_050_000, price: 138 },
                { time: 1_700_000_060_000, price: 126 },
            ]);
            // Cycles (3).
            draw.cyclicLines(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_060_000, price: 100 },
            );
            draw.timeCycles(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_060_000, price: 100 },
            );
            draw.sineLine(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_060_000, price: 120 },
            );
            // Containers (2).
            const f = draw.frame(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_060_000, price: 120 },
                { label: "All 61" },
            );
            draw.group([f.id]);
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "c2e924592962d7dc2be5529b687b97683c5b07d9a0d9927d2c8850ce86ef4d73",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * Task-19 smoke conformance scenario. Emits ONE of every `DrawingKind`
 * (61 total) in a single script on the first bar — exercises every
 * per-kind validator, every runtime emit fn, every canvas2d
 * `drawingDispatch` arm in one pass. Asserts the full 61-emission set
 * survives capability-gating + per-bucket budget enforcement and pins
 * a single `drawing-hash` across the entire batch.
 *
 * The `pitchfork` call carries `variant: "schiff"` to cover the
 * non-default variant path; `path` (open polyline at the renderer)
 * coexists with `polyline` (closed polyline) to cover the
 * open/closed distinction.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_ALL_61_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_ALL_61_SCENARIO;
 */
export const DRAW_ALL_61_SCENARIO: Scenario = Object.freeze({
    id: "draw-all-61",
    title: "Task 19 smoke (all 61 DrawingKinds emitted on a single bar)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
