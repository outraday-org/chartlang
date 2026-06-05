// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.obv()",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot }) {
        plot(ta.obv());
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.obv` conformance scenario. Plots the cumulative On-Balance
 * Volume over the bundled 10 000-bar `goldenBars.json` fixture in its
 * own pane (volume category — `overlay: false`).
 *
 * @since 0.2
 * @experimental
 * @example
 *     import { TA_OBV_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_OBV_SCENARIO;
 */
export const TA_OBV_SCENARIO: Scenario = Object.freeze({
    id: "ta-obv",
    title: "ta.obv()",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
