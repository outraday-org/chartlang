// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { RunnerState } from "../createScriptRunner.js";
import { flushStateSlots } from "../state/index.js";

/**
 * Tear down the runner's buffers and state. After `dispose`:
 *
 * - Every OHLCV ring buffer's `length` is 0 (via `RingBufferLike.reset`).
 * - The `taSlots` map is empty (Task 7 primitives lose their hidden
 *   state).
 * - Runtime `state.*` slots are flushed into `StateStore`, then the
 *   runner-local slot map is cleared. The backing `StateStore` remains
 *   host-owned so warm restart can restore the snapshot.
 * - The four emission arrays are reset to empty (`drain()` after
 *   `dispose` returns empty arrays).
 *
 * `state.barIndex` is NOT reset — `dispose` is one-shot. Re-use after
 * `dispose` is not supported and not tested.
 *
 * @since 0.1
 * @example
 *     // import { dispose } from "@invinite-org/chartlang-runtime";
 *     // dispose(state);
 */
export function dispose(state: RunnerState): void {
    for (const dep of state.depRunners) {
        dispose(dep.state);
    }
    for (const sibling of state.siblingRunners) {
        dispose(sibling.state);
    }
    state.depOutputStore?.dispose();
    flushStateSlots(state.runtimeContext);
    for (const buf of Object.values(state.mainStream.ohlcv)) {
        buf.reset();
    }
    for (const stream of state.runtimeContext.secondaryStreams.values()) {
        for (const buf of Object.values(stream.ohlcv)) {
            buf.reset();
        }
        stream.taSlots.clear();
    }
    state.mainStream.taSlots.clear();
    state.emissions.plots = [];
    state.emissions.drawings = [];
    state.emissions.alerts = [];
    state.emissions.diagnostics = [];
    state.runtimeContext.drawingSlots.clear();
    state.runtimeContext.drawingSubIdCounters.clear();
    state.runtimeContext.stateSlots.clear();
    state.runtimeContext.seriesSlots.clear();
    state.runtimeContext.secondaryStreams.clear();
    state.runtimeContext.requestSecurityBars.clear();
    state.runtimeContext.requestSecurityAlignments.clear();
    state.runtimeContext.requestSecurityAscendingBars.clear();
    state.runtimeContext.requestSecurityExprSeries?.clear();
    const exprRunners = state.runtimeContext.securityExprRunners;
    if (exprRunners !== undefined) {
        for (const runner of exprRunners.values()) {
            for (const buf of Object.values(runner.foldStream.ohlcv)) {
                buf.reset();
            }
            runner.foldStream.taSlots.clear();
            runner.output.reset();
        }
        // Drops every runner reference; the per-interval index holds the same
        // (now-reset) objects, so clearing `bySlot` is the authoritative
        // teardown. The whole `RuntimeContext` is discarded after dispose.
        exprRunners.clear();
    }
    state.runtimeContext.requestLowerTfViews.clear();
    state.runtimeContext.diagnosedRequestKeys.clear();
    state.runtimeContext.diagnosedInputKeys.clear();
    const counters = state.runtimeContext.drawingBucketCounters;
    counters.lines = 0;
    counters.labels = 0;
    counters.boxes = 0;
    counters.polylines = 0;
    counters.other = 0;
}
