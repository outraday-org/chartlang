// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.cross(ema9, ema21)",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        const fast = ta.ema(bar.close, 9);
        const slow = ta.ema(bar.close, 21);
        // ta.cross returns Series<boolean>; surface it as a plottable
        // Series<number> via ta.barssince so the runtime still steps the
        // underlying composed crossover/crossunder sub-slots per bar.
        plot(ta.barssince(ta.cross(fast, slow)));
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.cross` conformance scenario. Plots `bar.close` on every bar where a
 * fast EMA crosses a slow EMA in either direction over the bundled
 * 10 000-bar `goldenBars.json` fixture.
 *
 * @since 1.8
 * @stable
 * @example
 *     import { TA_CROSS_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_CROSS_SCENARIO;
 */
export const TA_CROSS_SCENARIO: Scenario = Object.freeze({
    id: "ta-cross",
    title: "ta.cross(ema9, ema21)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
