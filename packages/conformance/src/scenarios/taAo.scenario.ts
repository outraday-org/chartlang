// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.ao()",
    apiVersion: 1,
    overlay: true,
    compute({ ta, plot }) {
        plot(ta.ao());
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.ao` conformance scenario. Plots the Awesome Oscillator
 * (SMA(hl2, 5) − SMA(hl2, 34)) over the bundled 10 000-bar
 * `goldenBars.json` fixture.
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_AO_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_AO_SCENARIO;
 */
export const TA_AO_SCENARIO: Scenario = Object.freeze({
    id: "ta-ao",
    title: "ta.ao()",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
