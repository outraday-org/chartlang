// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

// Bundle scenario for Task 12 — emits one drawing per fib kind on the
// first bar (5 fib-A + 5 fib-B = 10 emissions). All 10 map to the
// `other` bucket. Per README §22.10 Task 12 supersedes Task 11's
// `drawFibA.scenario.ts` with this wider bundle.
const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "drawFibAll bundle",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.fibRetracement(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_030_000_000, price: 120 },
                { showLabels: true },
            );
            draw.fibTrendExtension(
                [
                    { time: 1_700_000_000_000, price: 100 },
                    { time: 1_700_030_000_000, price: 130 },
                    { time: 1_700_060_000_000, price: 115 },
                ],
                { showLabels: true },
            );
            draw.fibChannel(
                [
                    { time: 1_700_000_000_000, price: 100 },
                    { time: 1_700_030_000_000, price: 120 },
                    { time: 1_700_000_000_000, price: 90 },
                ],
                { showLabels: true },
            );
            draw.fibTimeZone(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_030_000_000, price: 100 },
                { showLabels: true },
            );
            draw.fibWedge(
                [
                    { time: 1_700_000_000_000, price: 100 },
                    { time: 1_700_030_000_000, price: 130 },
                    { time: 1_700_030_000_000, price: 70 },
                ],
                { showLabels: true },
            );
            draw.fibSpeedFan(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_030_000_000, price: 120 },
                { showLabels: true },
            );
            draw.fibSpeedArcs(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_030_000_000, price: 120 },
                { showLabels: true },
            );
            draw.fibSpiral(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_030_000_000, price: 120 },
            );
            draw.fibCircles(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_030_000_000, price: 120 },
                { showLabels: true },
            );
            draw.fibTrendTime(
                [
                    { time: 1_700_000_000_000, price: 100 },
                    { time: 1_700_030_000_000, price: 130 },
                    { time: 1_700_060_000_000, price: 115 },
                ],
                { showLabels: true },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "a1cb287e997cae49937dfac711b0f0f293bcf65a3de86cdcfa10b6577f89b72b",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * Task-12 category-bundle conformance scenario. Emits one drawing per
 * fib kind on the first bar (5 fib-A + 5 fib-B = 10 emissions) and
 * pins one `drawing-hash` across all 10. Per README §22.10 this
 * supersedes Task 11's `drawFibA.scenario.ts` (deleted in this PR).
 *
 * @since 0.3
 * @experimental
 * @example
 *     import { DRAW_FIB_ALL_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_FIB_ALL_SCENARIO;
 */
export const DRAW_FIB_ALL_SCENARIO: Scenario = Object.freeze({
    id: "draw-fib-all",
    title: "Task 12 fib-all bundle (all 10 fib kinds on a single bar)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
