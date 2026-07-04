// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";

import { type RunnerState, resetStateForHistoryReseed } from "../createScriptRunner.js";
import { onBarClose } from "./onBarClose.js";

/**
 * Bulk-fill warmup. Walks `bars` forward and runs `onBarClose` per
 * entry, preserving the §6.4 determinism contract (every bar passes
 * through `compute` in source order). A Phase-2 optimisation could
 * pre-fill ring buffers without re-running compute, but stay correct
 * first.
 *
 * Emissions accumulate across the bulk walk: PLAN §6.1 promises
 * `drain()` returns every emission "since the last drain", but
 * `onBarClose` resets the per-bar queues at the top of each bar. Without
 * the accumulator below, a host that pushes a `{ kind: "history", bars }`
 * event and drains once afterwards (as `canvas2d-adapter` does) would
 * only see the final bar's emissions. We seed the accumulators from
 * the pre-history queues so an undrained prior emission isn't silently
 * dropped, then write the merged arrays back at the end. `fromBar`
 * reverts to the first bar of the walk; `toBar` is left as the final
 * `onBarClose` set it (the last bar's index).
 *
 * Errors thrown by `compute` propagate immediately — subsequent bars
 * do not run. The host (Task 9) owns containment + reporting.
 *
 * **Re-seed on an OVERLAPPING history push.** A `history` push whose runner
 * has already consumed bars (`state.barIndex > 0`) AND whose first bar does
 * not land strictly after the last closed bar (`bars[0].time <= last closed
 * time`) is a full re-seed, not an append: {@link resetStateForHistoryReseed}
 * rebuilds the whole `RunnerState` (streams, slots, dep/sibling runners,
 * external-series slots) preserving the latest live `setExternalSeries` /
 * `setPlotOverrides` maps, drops any undrained pre-reseed emissions, then this
 * walk replays `bars` from bar 0 so `fromBar` lands at 0. A FORWARD
 * CONTINUATION — every incoming bar strictly newer than the last close, the
 * shape a host emits when it chunks one conceptual history load (e.g.
 * canvas2d's `createMultiStreamCandlePump` weaving secondary closes between
 * main-history chunks) — appends exactly as before the re-seed feature.
 * Fresh runners (`barIndex === 0`) take the append path unchanged. The guard
 * lives here — the single choke point both `runner.onHistory()` and
 * `runner.push({ kind: "history" })` route through — so neither entry point
 * can skip it.
 *
 * @since 0.1
 * @example
 *     // import { onHistory } from "@invinite-org/chartlang-runtime";
 *     // await onHistory(state, historicalBars);
 *     // const out = drain(state); // every bar's emissions, not just the last.
 */
export async function onHistory(state: RunnerState, bars: ReadonlyArray<Bar>): Promise<void> {
    if (bars.length === 0) return;
    // Re-seed only when the batch OVERLAPS already-processed history (its
    // first bar does not land strictly after the last closed bar). A forward
    // continuation (all bars newer) is an append — hosts chunk history loads.
    const firstBar = bars[0];
    if (
        state.barIndex > 0 &&
        firstBar !== undefined &&
        firstBar.time <= state.mainStream.ohlcv.time.at(0)
    ) {
        resetStateForHistoryReseed(state);
    }
    const fromBar = state.barIndex;
    const plots = state.emissions.plots;
    const drawings = state.emissions.drawings;
    const alerts = state.emissions.alerts;
    const alertConditions = state.emissions.alertConditions ?? [];
    const logs = state.emissions.logs;
    const diagnostics = state.emissions.diagnostics;
    for (const bar of bars) {
        await onBarClose(state, bar, "history");
        plots.push(...state.emissions.plots);
        drawings.push(...state.emissions.drawings);
        alerts.push(...state.emissions.alerts);
        alertConditions.push(...(state.emissions.alertConditions ?? []));
        logs.push(...state.emissions.logs);
        diagnostics.push(...state.emissions.diagnostics);
    }
    state.emissions.plots = plots;
    state.emissions.drawings = drawings;
    state.emissions.alerts = alerts;
    state.emissions.alertConditions = alertConditions;
    state.emissions.logs = logs;
    state.emissions.diagnostics = diagnostics;
    state.emissions.fromBar = fromBar;
    // `toBar` was set to the last bar's index by the final `onBarClose`.
}
