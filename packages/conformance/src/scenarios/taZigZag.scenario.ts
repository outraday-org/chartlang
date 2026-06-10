// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.zigZag({ deviation: 5 })",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        const z = ta.zigZag({ deviation: 5 });
        plot(z.value);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.zigZag` conformance scenario. Plots the trailing-pivot `value`
 * Series over the bundled 10 000-bar `goldenBars.json` fixture.
 * Asserts the conformance-suite contract only — clean run with no
 * alerts and no validation diagnostics.
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_ZIG_ZAG_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_ZIG_ZAG_SCENARIO;
 */
export const TA_ZIG_ZAG_SCENARIO: Scenario = Object.freeze({
    id: "ta-zigZag",
    title: "ta.zigZag({ deviation: 5 })",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
