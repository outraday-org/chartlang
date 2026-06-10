// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.connorsRsi(close)",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        plot(ta.connorsRsi(bar.close));
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.connorsRsi` conformance scenario. Plots the Connors RSI
 * (RSI(3) + RSI(streak, 2) + PercentRank(ROC, 100), averaged) over
 * the bundled 10 000-bar `goldenBars.json` fixture using Larry
 * Connors' canonical (3, 2, 100) defaults. Output is bounded
 * `[0, 100]` per `TA_REGISTRY_METADATA.connorsRsi`.
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_CONNORS_RSI_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_CONNORS_RSI_SCENARIO;
 */
export const TA_CONNORS_RSI_SCENARIO: Scenario = Object.freeze({
    id: "ta-connors-rsi",
    title: "ta.connorsRsi(close)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
