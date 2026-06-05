// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.ichimoku()",
    apiVersion: 1,
    overlay: true,
    compute({ ta, plot }) {
        const i = ta.ichimoku();
        plot(i.tenkan);
        plot(i.kijun);
        plot(i.senkouA);
        plot(i.senkouB);
        plot(i.chikou);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.ichimoku` conformance scenario. Plots the five Ichimoku Cloud
 * series (Tenkan / Kijun / Senkou A / Senkou B / Chikou) at default
 * `(9, 26, 52, 26)` settings over the bundled 10 000-bar
 * `goldenBars.json` fixture.
 *
 * @since 0.2
 * @experimental
 * @example
 *     import { TA_ICHIMOKU_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_ICHIMOKU_SCENARIO;
 */
export const TA_ICHIMOKU_SCENARIO: Scenario = Object.freeze({
    id: "ta-ichimoku",
    title: "ta.ichimoku()",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
