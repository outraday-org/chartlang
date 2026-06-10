// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.tema(close, 20)",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        plot(ta.tema(bar.close, 20));
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.tema` conformance scenario. Plots a 20-bar triple exponential
 * moving average of `bar.close` over the bundled 10 000-bar
 * `goldenBars.json` fixture.
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_TEMA_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_TEMA_SCENARIO;
 */
export const TA_TEMA_SCENARIO: Scenario = Object.freeze({
    id: "ta-tema",
    title: "ta.tema(close, 20)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
