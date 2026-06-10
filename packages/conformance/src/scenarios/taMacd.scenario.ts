// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.macd(close)",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        const m = ta.macd(bar.close);
        plot(m.macd);
        plot(m.signal);
        plot(m.hist);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.macd` conformance scenario. Plots the MACD line, the signal
 * line, and the histogram of MACD(close, 12, 26, 9) over the bundled
 * 10 000-bar `goldenBars.json` fixture in its own pane
 * (`overlay: false`).
 *
 * @since 0.2.2
 * @stable
 * @example
 *     import { TA_MACD_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_MACD_SCENARIO;
 */
export const TA_MACD_SCENARIO: Scenario = Object.freeze({
    id: "ta-macd",
    title: "ta.macd(close) — default 12/26/9",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
