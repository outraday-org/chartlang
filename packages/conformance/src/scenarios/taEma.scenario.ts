// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.ema(close, 20)",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        plot(ta.ema(bar.close, 20));
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.ema` conformance scenario. Plots a 20-bar exponential moving
 * average of `bar.close` over the bundled 10 000-bar `goldenBars.json`
 * fixture. Distinct from `EMA_CROSS_SCENARIO`, which pins the curated
 * `ema-cross.chart.ts` example — this scenario exists so the §22.10
 * contract "one dedicated scenario per `ta.*` primitive" holds for
 * `ta.ema`.
 *
 * @since 0.2.2
 * @stable
 * @example
 *     import { TA_EMA_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_EMA_SCENARIO;
 */
export const TA_EMA_SCENARIO: Scenario = Object.freeze({
    id: "ta-ema",
    title: "ta.ema(close, 20)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
