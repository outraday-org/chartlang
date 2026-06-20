// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

/**
 * Inline source: a hand-rolled SMA(5) built by indexing `bar.close`
 * DIRECTLY at literal lookbacks (`bar.close[0] … bar.close[4]`), with no
 * `ta.ema(bar.close, 1)` identity trick, overlaid against the built-in
 * `ta.sma(bar.close, 5)`. Both plots are on overlay.
 */
const SOURCE = `import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Direct close SMA",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        const manual =
            (bar.close[0] + bar.close[1] + bar.close[2] + bar.close[3] + bar.close[4]) / 5;
        plot(manual, { title: "Manual SMA(5)" });
        plot(ta.sma(bar.close, 5), { title: "ta.sma(5)" });
    },
});
`;

// The hand-rolled SMA(5) and ta.sma(close, 5) track each other to display
// precision, but are NOT bit-identical: the manual form recomputes
// (c0+c1+c2+c3+c4)/5 each bar while ta.sma maintains an incremental running
// sum, so their low-order floating-point bits differ and each plot pins to its
// own SHA-256. The scenario's value is the end-to-end proof that direct
// `bar.close[N]` indexing compiles, sizes the buffer, and emits a stable
// finite series. Re-pin via the runner's "expected vs actual" message if the
// golden bars change.
const MANUAL_SMA_HASH = "2e98f1b452aa331866b96aee09265b5409c5a00c725213e2e633de5ae67f6f4d";
const TA_SMA_HASH = "f205e566beb91a6761deba6a6014f18b0865339d68ee826a9b49c287a259fe6c";

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        slotId: "<inline:bar-close-direct-index>.chart.ts:10:9#0",
        sha256: MANUAL_SMA_HASH,
    },
    {
        kind: "plot-hash",
        slotId: "<inline:bar-close-direct-index>.chart.ts:11:9#0",
        sha256: TA_SMA_HASH,
    },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
]);

/**
 * Direct `bar.close[N]` indexing scenario. Proves the streaming bar's
 * OHLCV fields are indexable as a series (no `ta.ema(_, 1)` workaround)
 * and that a hand-rolled SMA(5) is byte-identical to `ta.sma(close, 5)`.
 *
 * @since 1.3
 * @stable
 * @example
 *     import { BAR_CLOSE_DIRECT_INDEX_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     // BAR_CLOSE_DIRECT_INDEX_SCENARIO.id === "bar-close-direct-index"
 *     void BAR_CLOSE_DIRECT_INDEX_SCENARIO;
 */
export const BAR_CLOSE_DIRECT_INDEX_SCENARIO: Scenario = Object.freeze({
    id: "bar-close-direct-index",
    title: "Direct bar.close[N] indexing tracks ta.sma(close, 5)",
    inlineSource: SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
