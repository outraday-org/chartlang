// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.median(close, 21)",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        plot(ta.median(bar.close, 21));
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.median` conformance scenario. Plots a 21-bar rolling median of
 * `bar.close` over the bundled 10 000-bar `goldenBars.json` fixture.
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_MEDIAN_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_MEDIAN_SCENARIO;
 */
export const TA_MEDIAN_SCENARIO: Scenario = Object.freeze({
    id: "ta-median",
    title: "ta.median(close, 21)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
