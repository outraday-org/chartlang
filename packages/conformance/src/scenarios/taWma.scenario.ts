// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.wma(close, 14)",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        plot(ta.wma(bar.close, 14));
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.wma` conformance scenario. Plots a 14-bar weighted moving
 * average of `bar.close` over the bundled 10 000-bar `goldenBars.json`
 * fixture.
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_WMA_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_WMA_SCENARIO;
 */
export const TA_WMA_SCENARIO: Scenario = Object.freeze({
    id: "ta-wma",
    title: "ta.wma(close, 14)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
