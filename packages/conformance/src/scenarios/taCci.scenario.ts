// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.cci(hlc3, 20)",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        plot(ta.cci(bar.hlc3, 20));
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.cci` conformance scenario. Plots a 20-bar CCI over `bar.hlc3`
 * across the bundled 10 000-bar `goldenBars.json` fixture.
 *
 * @since 0.2
 * @experimental
 * @example
 *     import { TA_CCI_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_CCI_SCENARIO;
 */
export const TA_CCI_SCENARIO: Scenario = Object.freeze({
    id: "ta-cci",
    title: "ta.cci(hlc3, 20)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
