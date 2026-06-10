// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.maRibbon(close, lengths=[10,20,30], maType=ema)",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        const r = ta.maRibbon(bar.close, { lengths: [10, 20, 30], maType: "ema" });
        plot(r.ma_10);
        plot(r.ma_20);
        plot(r.ma_30);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.maRibbon` conformance scenario. Plots a 3-output EMA ribbon
 * (`lengths = [10, 20, 30]`) over the bundled 10 000-bar
 * `goldenBars.json` fixture. Exercises the multi-output sub-slot
 * dispatch through `TA_REGISTRY`'s `ema` primitive.
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_MA_RIBBON_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_MA_RIBBON_SCENARIO;
 */
export const TA_MA_RIBBON_SCENARIO: Scenario = Object.freeze({
    id: "ta-maRibbon",
    title: "ta.maRibbon(close, lengths=[10,20,30], maType=ema)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
