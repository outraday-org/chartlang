// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.lsma(close, 25)",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        plot(ta.lsma(bar.close, 25));
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.lsma` conformance scenario. Plots the 25-bar least-squares
 * regression value of `bar.close` over the bundled 10 000-bar
 * `goldenBars.json` fixture.
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_LSMA_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_LSMA_SCENARIO;
 */
export const TA_LSMA_SCENARIO: Scenario = Object.freeze({
    id: "ta-lsma",
    title: "ta.lsma(close, 25)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
