// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.eom(14)",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot }) {
        plot(ta.eom(14));
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.eom` conformance scenario. Plots the 14-bar Ease of Movement
 * over the bundled 10 000-bar `goldenBars.json` fixture in its own
 * pane. EOM uses invinite's default divisor of 10000; zero-range and
 * zero-volume bars propagate NaN through the window.
 *
 * @since 0.2
 * @experimental
 * @example
 *     import { TA_EOM_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_EOM_SCENARIO;
 */
export const TA_EOM_SCENARIO: Scenario = Object.freeze({
    id: "ta-eom",
    title: "ta.eom(14)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
