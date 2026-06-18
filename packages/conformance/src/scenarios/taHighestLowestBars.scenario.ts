// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.highestbars / ta.lowestbars",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        plot(ta.highestbars(bar.high, 20));
        plot(ta.lowestbars(bar.low, 20));
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.highestbars` / `ta.lowestbars` conformance scenario. Plots the
 * 20-bar argmax / argmin bar OFFSETS (≤ 0) of `bar.high` / `bar.low`
 * over the bundled 10 000-bar `goldenBars.json` fixture, exercising the
 * offset-returning primitives end-to-end through the compiler + runtime.
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_HIGHEST_LOWEST_BARS_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_HIGHEST_LOWEST_BARS_SCENARIO;
 */
export const TA_HIGHEST_LOWEST_BARS_SCENARIO: Scenario = Object.freeze({
    id: "ta-highestbars-lowestbars",
    title: "ta.highestbars / ta.lowestbars",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
