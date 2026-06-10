// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.chop(14)",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        plot(ta.chop(14));
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.chop` conformance scenario. Plots Choppiness Index (length=14)
 * over the bundled 10 000-bar `goldenBars.json` fixture. Output is
 * bounded to [0, 100] (high values signal a choppy / sideways
 * market; low values signal a strong trend).
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_CHOP_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_CHOP_SCENARIO;
 */
export const TA_CHOP_SCENARIO: Scenario = Object.freeze({
    id: "ta-chop",
    title: "ta.chop(14)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
