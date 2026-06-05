// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.change(close, { length: 5 })",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        plot(ta.change(bar.close, { length: 5 }));
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.change` conformance scenario. Plots the 5-bar first-difference
 * of `bar.close` over the bundled 10 000-bar `goldenBars.json` fixture.
 *
 * @since 0.2
 * @experimental
 * @example
 *     import { TA_CHANGE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_CHANGE_SCENARIO;
 */
export const TA_CHANGE_SCENARIO: Scenario = Object.freeze({
    id: "ta-change",
    title: "ta.change(close, { length: 5 })",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
