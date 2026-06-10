// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.sma(close, 20)",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        plot(ta.sma(bar.close, 20));
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.sma` conformance scenario. Plots a 20-bar simple moving
 * average of `bar.close` over the bundled 10 000-bar `goldenBars.json`
 * fixture.
 *
 * @since 0.2.2
 * @stable
 * @example
 *     import { TA_SMA_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_SMA_SCENARIO;
 */
export const TA_SMA_SCENARIO: Scenario = Object.freeze({
    id: "ta-sma",
    title: "ta.sma(close, 20)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
