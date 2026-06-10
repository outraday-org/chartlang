// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.rsi(close, 14)",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        plot(ta.rsi(bar.close, 14));
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.rsi` conformance scenario. Plots Wilder's Relative Strength
 * Index (`rsi(close, 14)`) over the bundled 10 000-bar
 * `goldenBars.json` fixture in its own pane (`overlay: false`).
 * Distinct from `RSI_DIVERGENCE_SCENARIO`, which pins the curated
 * `rsi-divergence-alert.chart.ts` example end-to-end — this scenario
 * exists so the §22.10 contract "one dedicated scenario per `ta.*`
 * primitive" holds for `ta.rsi`.
 *
 * @since 0.2.2
 * @stable
 * @example
 *     import { TA_RSI_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_RSI_SCENARIO;
 */
export const TA_RSI_SCENARIO: Scenario = Object.freeze({
    id: "ta-rsi",
    title: "ta.rsi(close, 14)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
