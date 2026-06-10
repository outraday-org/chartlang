// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.roc(close, 12)",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        plot(ta.roc(bar.close, 12));
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.roc` conformance scenario. Plots the 12-bar Rate of Change
 * of `bar.close` over the bundled 10 000-bar `goldenBars.json`
 * fixture.
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_ROC_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_ROC_SCENARIO;
 */
export const TA_ROC_SCENARIO: Scenario = Object.freeze({
    id: "ta-roc",
    title: "ta.roc(close, 12)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
