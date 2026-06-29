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

// Value-pins the REAL-path ATR series over the bundled golden bars. `ta.atr`
// reads `bar.high`/`bar.low`/`bar.close` (number-coercible series-view proxies)
// directly; before the §-proxy-coercion fix the real onBarClose path returned
// NaN every bar (the proxy is never `Number.isFinite`), masked because the unit
// harness injected plain-number bar fields. This hash is the regression guard.
// Re-pin via the runner's "expected vs actual" message if the golden bars change.
const ATR_HASH = "6f7e264908a48e5b99eb03cb2315a78c54545250b7c861ea8e50d37ff5c5b76d";

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "plot-hash", slotId: "<inline:ta-atr>.chart.ts:7:9#0", sha256: ATR_HASH },
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
