// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

/**
 * Inline source: a rolling window of the last five closes built with the
 * persistent collection `state.array<number>(5)`. Each bar pushes
 * `bar.close.current` (FIFO-evicting the oldest once full), then sums the
 * window with an in-loop `win.get(i)` (a HANDLE method, so it is legal inside
 * the loop body — only the allocation `state.array(...)` is a stateful
 * registry callsite). The `for` is bounded by the capacity literal `5` (the
 * compiler's `unbounded-loop` rule requires a literal numeric bound, so the
 * loop counts to `5` and the `i < win.size` guard skips the unfilled slots
 * during warmup). Plots `sum / size` against the built-in `ta.sma(bar.close,
 * 5)`; both plots are on overlay.
 */
const SOURCE = `import { defineIndicator, plot, state, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Rolling window mean",
    apiVersion: 1,
    overlay: true,
    compute({ bar, state, ta, plot }) {
        const win = state.array<number>(5);
        win.push(bar.close.current);
        let sum = 0;
        for (let i = 0; i < 5; i++) if (i < win.size) sum += win.get(i);
        plot(win.size > 0 ? sum / win.size : 0, { title: "Window mean(5)" });
        plot(ta.sma(bar.close, 5), { title: "ta.sma(5)" });
    },
});
`;

// The rolling-window mean and ta.sma(close, 5) track each other once warm but
// are NOT bit-identical: the window mean averages over `size` (< 5 during
// warmup, so it is FINITE from bar 0 — no NaN warmup), while ta.sma emits NaN
// until it has five closes and then maintains an incremental running sum. Each
// plot therefore pins to its own SHA-256. The scenario's value is the
// end-to-end proof that `state.array` compiles, allocates, accumulates with
// FIFO eviction, survives the close/commit discipline, and emits a stable
// finite series. Re-pin via the runner's "expected vs actual" message if the
// golden bars change.
const WINDOW_MEAN_HASH = "d45ddf790758f0e721b9ac3e021b71e3acee54e681dbb938e852f879d81db071";
// Byte-identical to ta.sma(close, 5) in barCloseDirectIndex.scenario.ts — the
// runtime SMA is deterministic, so the same primitive over the same golden
// bars pins to the same SHA-256 regardless of the surrounding script.
const TA_SMA_HASH = "f205e566beb91a6761deba6a6014f18b0865339d68ee826a9b49c287a259fe6c";

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        slotId: "<inline:state-array-rolling-window>.chart.ts:12:9#0",
        sha256: WINDOW_MEAN_HASH,
    },
    {
        kind: "plot-hash",
        slotId: "<inline:state-array-rolling-window>.chart.ts:13:9#0",
        sha256: TA_SMA_HASH,
    },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
]);

/**
 * `state.array` rolling-window scenario. Proves the persistent bounded FIFO
 * collection (`state.array<number>(5)`) compiles, allocates, accumulates with
 * FIFO eviction across bars, survives the close/commit discipline, and emits a
 * stable finite series: its rolling mean pins to its own SHA-256 and tracks
 * `ta.sma(close, 5)` once warm (which pins to its own NaN-warmup hash). The
 * in-loop `win.get(i)` proves handle methods are loop-legal (not a
 * `stateful-call-inside-loop` registry callsite).
 *
 * @since 1.4
 * @stable
 * @example
 *     import { STATE_ARRAY_ROLLING_WINDOW_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     // STATE_ARRAY_ROLLING_WINDOW_SCENARIO.id === "state-array-rolling-window"
 *     void STATE_ARRAY_ROLLING_WINDOW_SCENARIO;
 */
export const STATE_ARRAY_ROLLING_WINDOW_SCENARIO: Scenario = Object.freeze({
    id: "state-array-rolling-window",
    title: "state.array rolling-window mean is a stable finite series",
    inlineSource: SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
