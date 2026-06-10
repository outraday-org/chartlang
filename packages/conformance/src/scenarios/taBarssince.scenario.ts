// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.barssince(crossover(ema12, ema26))",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        const fast = ta.ema(bar.close, 12);
        const slow = ta.ema(bar.close, 26);
        plot(ta.barssince(ta.crossover(fast, slow)));
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.barssince` conformance scenario. Plots the number of bars since
 * the most recent EMA(12)/EMA(26) crossover.
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_BARSSINCE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_BARSSINCE_SCENARIO;
 */
export const TA_BARSSINCE_SCENARIO: Scenario = Object.freeze({
    id: "ta-barssince",
    title: "ta.barssince(ta.crossover(ta.ema(close,12), ta.ema(close,26)))",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
