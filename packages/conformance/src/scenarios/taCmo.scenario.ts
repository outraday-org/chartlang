// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.cmo(close, 9)",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        plot(ta.cmo(bar.close, 9));
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.cmo` conformance scenario. Plots the 9-bar Chande Momentum
 * Oscillator of `bar.close` over the bundled 10 000-bar
 * `goldenBars.json` fixture. Output is bounded `[-100, 100]`.
 *
 * @since 0.2
 * @experimental
 * @example
 *     import { TA_CMO_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_CMO_SCENARIO;
 */
export const TA_CMO_SCENARIO: Scenario = Object.freeze({
    id: "ta-cmo",
    title: "ta.cmo(close, 9)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
