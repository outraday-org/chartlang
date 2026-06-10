// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.ultimateOsc()",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        plot(ta.ultimateOsc());
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.ultimateOsc` conformance scenario. Plots the Ultimate Oscillator
 * with default opts (7, 14, 28) over the bundled 10 000-bar
 * `goldenBars.json` fixture.
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_ULTIMATE_OSC_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_ULTIMATE_OSC_SCENARIO;
 */
export const TA_ULTIMATE_OSC_SCENARIO: Scenario = Object.freeze({
    id: "ta-ultimateOsc",
    title: "ta.ultimateOsc()",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
