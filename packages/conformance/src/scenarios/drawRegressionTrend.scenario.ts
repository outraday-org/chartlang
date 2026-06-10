// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

// `bars[100..200]` window per task spec — `bars[100].time =
// 1_700_006_000_000`, `bars[200].time = 1_700_012_000_000`. The OLS
// fit itself is computed by consumer adapters (see
// `tasks/phase-3-drawing-parity/10-channels.plan.md` §3); the wire
// shape pinned here covers anchors + opts.
const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.regressionTrend demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.regressionTrend(
                { time: 1_700_006_000_000, price: 100 },
                { time: 1_700_012_000_000, price: 110 },
                {
                    source: "close",
                    stdevMultiplier: 2,
                    showUpperBand: true,
                    showLowerBand: true,
                    color: "#3b82f6",
                },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "89a4869b4b47bad4524be56a06def80d8a0e12d3288ebbef0decf5bb0f264cd5",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.regressionTrend` conformance scenario. Emits one
 * regression-trend drawing on the first bar with the full
 * `RegressionTrendOpts` payload (`source`, `stdevMultiplier`,
 * `showUpperBand`, `showLowerBand`, `color`) and pins the SHA-256 of
 * the resulting drawing batch — the wire shape, not the OLS fit
 * itself (the math reuses the public `linearRegression` helper).
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_REGRESSION_TREND_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_REGRESSION_TREND_SCENARIO;
 */
export const DRAW_REGRESSION_TREND_SCENARIO: Scenario = Object.freeze({
    id: "draw-regression-trend",
    title: "draw.regressionTrend(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
