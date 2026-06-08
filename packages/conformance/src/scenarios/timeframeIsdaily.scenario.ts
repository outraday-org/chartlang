// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "timeframe daily",
    apiVersion: 1,
    compute({ bar, plot, timeframe }) {
        plot(timeframe.isdaily ? bar.close : NaN);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        sha256: "76a745e34ca1752a77abb91cbf5e7d852700171923337b5acb9263f172e49bc5",
    },
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "unsupported-interval" },
]);

/**
 * `timeframe.isdaily` conformance scenario. The bundled golden bars are daily
 * candles, so every emitted value should be the bar close.
 *
 * @since 0.4
 * @experimental
 * @example
 *     import { TIMEFRAME_ISDAILY_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TIMEFRAME_ISDAILY_SCENARIO;
 */
export const TIMEFRAME_ISDAILY_SCENARIO: Scenario = Object.freeze({
    id: "timeframe-isdaily",
    title: "timeframe.isdaily on daily candles",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
