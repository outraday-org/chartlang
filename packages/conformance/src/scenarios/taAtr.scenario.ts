// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.atr(14)",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot }) {
        plot(ta.atr(14));
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.atr` conformance scenario. Plots Wilder's Average True Range
 * (length 14) over the bundled 10 000-bar `goldenBars.json` fixture
 * in its own pane (`overlay: false`). The primitive reads bar OHLC
 * directly — no `source` parameter — mirroring Pine's signature.
 *
 * @since 0.2.2
 * @stable
 * @example
 *     import { TA_ATR_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_ATR_SCENARIO;
 */
export const TA_ATR_SCENARIO: Scenario = Object.freeze({
    id: "ta-atr",
    title: "ta.atr(14)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
