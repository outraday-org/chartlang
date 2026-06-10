// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.volatilityStop({ length: 20, multiplier: 2 })",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        const v = ta.volatilityStop({ length: 20, multiplier: 2 });
        plot(v.value);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.volatilityStop` conformance scenario. Plots the trailing-stop
 * `value` Series over the bundled 10 000-bar `goldenBars.json`
 * fixture. Asserts the conformance-suite contract only — clean run
 * with no alerts and no validation diagnostics.
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_VOLATILITY_STOP_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_VOLATILITY_STOP_SCENARIO;
 */
export const TA_VOLATILITY_STOP_SCENARIO: Scenario = Object.freeze({
    id: "ta-volatilityStop",
    title: "ta.volatilityStop({ length: 20, multiplier: 2 })",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
