// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

// Bundle scenario for Task 8 — one emission per curve + freehand
// kind on the first bar. Per README §22.10 Task 8 collapses both the
// Curves and Freehand categories into one bundle covering all 6
// kinds (arc / curve / double-curve / pen / highlighter / brush).
// All map to the `polylines` bucket.
const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "drawCurvesAndFreehandAll bundle",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.arc(
                [
                    { time: 1_700_000_000_000, price: 100 },
                    { time: 1_700_030_000_000, price: 120 },
                    { time: 1_700_060_000_000, price: 100 },
                ],
                { color: "#3b82f6", lineWidth: 2 },
            );
            draw.curve(
                [
                    { time: 1_700_000_000_000, price: 100 },
                    { time: 1_700_030_000_000, price: 130 },
                    { time: 1_700_060_000_000, price: 100 },
                ],
                { color: "#22c55e", lineWidth: 1 },
            );
            draw.doubleCurve(
                [
                    { time: 1_700_000_000_000, price: 100 },
                    { time: 1_700_015_000_000, price: 130 },
                    { time: 1_700_030_000_000, price: 100 },
                    { time: 1_700_045_000_000, price: 70 },
                    { time: 1_700_060_000_000, price: 100 },
                ],
                { color: "#a855f7", lineWidth: 2 },
            );
            draw.pen(
                [
                    { time: 1_700_000_000_000, price: 100 },
                    { time: 1_700_030_000_000, price: 110 },
                    { time: 1_700_060_000_000, price: 105 },
                    { time: 1_700_090_000_000, price: 115 },
                ],
                { color: "#1e293b", lineWidth: 2 },
            );
            draw.highlighter(
                [
                    { time: 1_700_000_000_000, price: 100 },
                    { time: 1_700_030_000_000, price: 110 },
                    { time: 1_700_060_000_000, price: 105 },
                    { time: 1_700_090_000_000, price: 115 },
                ],
                { color: "#facc15", alpha: 0.3 },
            );
            draw.brush(
                [
                    { time: 1_700_000_000_000, price: 100 },
                    { time: 1_700_030_000_000, price: 120 },
                    { time: 1_700_060_000_000, price: 100 },
                    { time: 1_700_090_000_000, price: 80 },
                ],
                { stroke: "#000000", fill: "#dbeafe" },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "c223d3c066ff068baca069c7a2ff715c023990339c1b8c195b427b75a84b9584",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * Task-8 category-bundle conformance scenario. Emits one drawing per
 * curve + freehand kind on the first bar — `arc` / `curve` /
 * `double-curve` / `pen` / `highlighter` / `brush` — and pins one
 * `drawing-hash` across all 6 emissions. Per README §22.10 Task 8
 * collapses both categories into this single bundle.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_CURVES_AND_FREEHAND_ALL_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_CURVES_AND_FREEHAND_ALL_SCENARIO;
 */
export const DRAW_CURVES_AND_FREEHAND_ALL_SCENARIO: Scenario = Object.freeze({
    id: "draw-curves-and-freehand-all",
    title: "Task 8 curves + freehand bundle (all 6 kinds on a single bar)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
