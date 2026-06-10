// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.crossunder(sma(close,10), sma(close,30))",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        const fast = ta.sma(bar.close, 10);
        const slow = ta.sma(bar.close, 30);
        // ta.crossunder returns Series<boolean>; surface it as a
        // plottable Series<number> via ta.barssince so the runtime
        // still steps the underlying boolean slot per bar.
        plot(ta.barssince(ta.crossunder(fast, slow)));
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.crossunder` conformance scenario. Detects every bar where
 * `sma(close, 10)` crosses below `sma(close, 30)` and surfaces the
 * boolean result via `ta.barssince` so it can be plotted in its own
 * pane. Distinct from `EMA_CROSS_SCENARIO`, which pins the curated
 * `ema-cross.chart.ts` example end-to-end — this scenario exists so
 * the §22.10 contract "one dedicated scenario per `ta.*` primitive"
 * holds for `ta.crossunder`.
 *
 * @since 0.2.2
 * @stable
 * @example
 *     import { TA_CROSSUNDER_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_CROSSUNDER_SCENARIO;
 */
export const TA_CROSSUNDER_SCENARIO: Scenario = Object.freeze({
    id: "ta-crossunder",
    title: "ta.crossunder(ta.sma(close,10), ta.sma(close,30))",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
