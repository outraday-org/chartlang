// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.chaikinOsc()",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot }) {
        plot(ta.chaikinOsc());
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.chaikinOsc` conformance scenario. Plots the EMA-diff oscillator
 * over the bundled 10 000-bar `goldenBars.json` fixture with the
 * canonical (3, 10) defaults in its own pane.
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_CHAIKIN_OSC_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_CHAIKIN_OSC_SCENARIO;
 */
export const TA_CHAIKIN_OSC_SCENARIO: Scenario = Object.freeze({
    id: "ta-chaikinOsc",
    title: "ta.chaikinOsc()",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
