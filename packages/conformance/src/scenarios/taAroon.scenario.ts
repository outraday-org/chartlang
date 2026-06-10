// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.aroon(14)",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        const a = ta.aroon(14);
        plot(a.up);
        plot(a.down);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.aroon` conformance scenario. Plots the up and down lines of
 * Aroon(14) over the bundled 10 000-bar `goldenBars.json` fixture.
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_AROON_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_AROON_SCENARIO;
 */
export const TA_AROON_SCENARIO: Scenario = Object.freeze({
    id: "ta-aroon",
    title: "ta.aroon(14)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
