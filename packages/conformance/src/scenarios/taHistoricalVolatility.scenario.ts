// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.historicalVolatility(close, 10)",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        plot(ta.historicalVolatility(bar.close, 10));
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.historicalVolatility` conformance scenario. Plots Historical
 * Volatility(close, 10) over the bundled 10 000-bar `goldenBars.json`
 * fixture.
 *
 * @since 0.2
 * @experimental
 * @example
 *     import { TA_HISTORICAL_VOLATILITY_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_HISTORICAL_VOLATILITY_SCENARIO;
 */
export const TA_HISTORICAL_VOLATILITY_SCENARIO: Scenario = Object.freeze({
    id: "ta-historicalVolatility",
    title: "ta.historicalVolatility(close, 10)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
