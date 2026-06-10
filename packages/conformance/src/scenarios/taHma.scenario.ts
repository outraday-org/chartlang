// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.hma(close, 21)",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        plot(ta.hma(bar.close, 21));
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.hma` conformance scenario. Plots a 21-bar Hull moving average
 * of `bar.close` over the bundled 10 000-bar `goldenBars.json`
 * fixture. Exercises the three-sub-slot WMA composition (half + full
 * + final).
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_HMA_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_HMA_SCENARIO;
 */
export const TA_HMA_SCENARIO: Scenario = Object.freeze({
    id: "ta-hma",
    title: "ta.hma(close, 21)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
