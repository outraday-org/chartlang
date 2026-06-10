// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.valuewhen(crossover(sma10, sma30), close)",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        const fast = ta.sma(bar.close, 10);
        const slow = ta.sma(bar.close, 30);
        plot(ta.valuewhen(ta.crossover(fast, slow), bar.close));
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.valuewhen` conformance scenario. Plots the close price at every
 * fast-SMA-over-slow-SMA crossover, persisting the last match value
 * forward across non-cross bars.
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_VALUEWHEN_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_VALUEWHEN_SCENARIO;
 */
export const TA_VALUEWHEN_SCENARIO: Scenario = Object.freeze({
    id: "ta-valuewhen",
    title: "ta.valuewhen(ta.crossover(ta.sma(close,10), ta.sma(close,30)), close)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
