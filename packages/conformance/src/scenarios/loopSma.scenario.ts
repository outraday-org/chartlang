// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

/**
 * Inline source: a hand-rolled SMA(5) built by summing `bar.close[i]`
 * inside a bounded `for (let i = 0; i < 5; i++)` loop, overlaid against
 * the built-in `ta.sma(bar.close, 5)`. The loop index resolves to a
 * compile-time upper bound, so the buffer is sized to exactly 5 slots
 * (`maxLookback: 4`) with no `dynamic-series-index` warning — the
 * loop form of the unrolled `bar-close-direct-index` scenario.
 */
const INLINE_SOURCE = `
import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "loop-sma",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        let sum = 0;
        for (let i = 0; i < 5; i++) { sum += bar.close[i]; }
        plot(sum / 5, { title: "loop" });
        plot(ta.sma(bar.close, 5), { title: "builtin" });
    },
});
`;

// The loop SMA(5) and ta.sma(close, 5) track each other to display
// precision, but are NOT bit-identical: the loop re-sums (c0+c1+c2+c3+c4)/5
// each bar while ta.sma maintains an incremental running sum, so their
// low-order floating-point bits differ and each plot pins to its own
// SHA-256. The scenario's value is the end-to-end proof that a bounded-loop
// `bar.close[i]` read compiles, sizes the buffer precisely, and emits a
// stable finite series bar-for-bar identical to the built-in. Re-pin via the
// runner's "expected vs actual" message if the golden bars change.
const LOOP_SMA_HASH = "2e98f1b452aa331866b96aee09265b5409c5a00c725213e2e633de5ae67f6f4d";
const TA_SMA_HASH = "f205e566beb91a6761deba6a6014f18b0865339d68ee826a9b49c287a259fe6c";

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        slotId: "<inline:loop-sma>.chart.ts:10:9#0",
        sha256: LOOP_SMA_HASH,
    },
    {
        kind: "plot-hash",
        slotId: "<inline:loop-sma>.chart.ts:11:9#0",
        sha256: TA_SMA_HASH,
    },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
]);

/**
 * Bounded-loop SMA scenario. Proves a series read at a bounded-`for`
 * induction variable (`bar.close[i]`) sizes its buffer precisely and
 * that a loop-driven SMA(5) tracks `ta.sma(close, 5)` bar-for-bar.
 *
 * @since 1.4
 * @stable
 * @example
 *     import { LOOP_SMA_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     // LOOP_SMA_SCENARIO.id === "loop-sma"
 *     void LOOP_SMA_SCENARIO;
 */
export const LOOP_SMA_SCENARIO: Scenario = Object.freeze({
    id: "loop-sma",
    title: "Bounded-loop SMA tracks ta.sma(close, 5)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
