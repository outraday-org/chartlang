// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

/**
 * Inline source: a rolling 14-element window of the last closes built with the
 * persistent collection `state.array<number>(14)`. Each bar pushes
 * `bar.close.current` (FIFO-evicting the oldest once full), then plots the
 * window's rolling standard deviation (`win.stdev()`, population) and its
 * rolling median (`win.median()`). Both reductions are HANDLE methods — they
 * read the runtime ring directly and skip NaN — so the only stateful registry
 * callsite is the `state.array(...)` allocation. The series flow into the
 * existing `plot` hole, so the scenario needs NO new wire primitive and NO
 * per-adapter code: `pnpm conformance` replays it through every adapter and
 * asserts the plot hashes are byte-stable.
 */
const SOURCE = `import { defineIndicator, plot, state } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Rolling reductions",
    apiVersion: 1,
    overlay: true,
    compute({ bar, state, plot }) {
        const win = state.array<number>(14);
        win.push(bar.close.current);
        plot(win.stdev(), { title: "Rolling stdev(14)" });
        plot(win.median(), { title: "Rolling median(14)" });
    },
});
`;

// The rolling stdev + median are finite from bar 1 (each reduces over the
// filled `size`, which is < 14 during warmup, never NaN) and deterministic over
// the shared golden bars, so each plot pins to its own SHA-256. The hash is
// IDENTICAL across all conformance adapters — that is the byte-stable proof for
// the pure-compute `array.*` reduction surface (no new wire primitive, no
// per-adapter code). Re-pin via the runner's "expected vs actual" message only
// if the golden bars change.
const STDEV_HASH = "ce261f65ff4b8475b663dc18679a27214d9791be01ccaa80656c5f11fb9bf40c";
const MEDIAN_HASH = "8e4212a40815d1ece158bfcaf1493c8f455005e60be8e162b555df255b695b7d";

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        slotId: "<inline:array-rolling-stats>.chart.ts:10:9#0",
        sha256: STDEV_HASH,
    },
    {
        kind: "plot-hash",
        slotId: "<inline:array-rolling-stats>.chart.ts:11:9#0",
        sha256: MEDIAN_HASH,
    },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
]);

/**
 * `state.array` rolling-reduction scenario. Proves the numeric-reduction methods
 * (`win.stdev()`/`win.median()`) on the persistent bounded FIFO collection
 * compile, allocate, accumulate with FIFO eviction across bars, survive the
 * close/commit discipline, and emit byte-stable finite series — the all-adapter
 * proof for the `array.*` analytic surface (a reduction returns a `number` that
 * rides the existing `plot` hole; no new wire primitive, no per-adapter code).
 *
 * @since 1.4
 * @stable
 * @example
 *     import { ARRAY_ROLLING_STATS_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     // ARRAY_ROLLING_STATS_SCENARIO.id === "array-rolling-stats"
 *     void ARRAY_ROLLING_STATS_SCENARIO;
 */
export const ARRAY_ROLLING_STATS_SCENARIO: Scenario = Object.freeze({
    id: "array-rolling-stats",
    title: "state.array rolling stdev/median are byte-stable finite series",
    inlineSource: SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
