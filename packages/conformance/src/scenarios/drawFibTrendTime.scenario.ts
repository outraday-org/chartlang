// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.fibTrendTime demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
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
        sha256: "9e3acd1696432d28ff57bf87074b7c15541e66f80ee51d1ce5ffc3007502cd26",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.fibTrendTime` conformance scenario. Emits one fib-trend-time on
 * the first bar with `goldenBars[0]`, `goldenBars[500]`, and
 * `goldenBars[1000]` as the A/B/C anchors (A→B leg defines the time
 * delta; C is the projection origin).
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_FIB_TREND_TIME_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_FIB_TREND_TIME_SCENARIO;
 */
export const DRAW_FIB_TREND_TIME_SCENARIO: Scenario = Object.freeze({
    id: "draw-fib-trend-time",
    title: "draw.fibTrendTime(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
