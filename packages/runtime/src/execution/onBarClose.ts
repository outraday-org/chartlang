// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";

import { buildComputeContext } from "../buildComputeContext";
import type { RunnerState } from "../createScriptRunner";
import { ACTIVE_RUNTIME_CONTEXT } from "../runtimeContext";

/**
 * §6.7 main step. Appends every OHLCV ring buffer, mutates the runner's
 * shared `BarView` in place, clears the per-bar emission queues, and
 * runs the script's `compute` under `ACTIVE_RUNTIME_CONTEXT`. The four
 * §6.7 invariants hold at the end of step 3 (right before `compute`).
 *
 * The derived sources (`hl2` / `hlc3` / `ohlc4` / `hlcc4`) come from
 * `rawBar` directly — cheaper than `ohlcv.X.at(0)` and sidesteps
 * `noNonNullAssertion`. The buffer and the `BarView` carry identical
 * values either way.
 *
 * `barIndex` advances exactly once per close. Errors thrown by
 * `compute` propagate out of `onBarClose`; the host (Task 9) owns
 * containment.
 *
 * @since 0.1
 * @example
 *     // import { onBarClose } from "@invinite-org/chartlang-runtime";
 *     // await onBarClose(state, rawBar);
 */
export async function onBarClose(state: RunnerState, rawBar: Bar): Promise<void> {
    const { ohlcv, bar } = state.mainStream;
    const hl2 = (rawBar.high + rawBar.low) / 2;
    const hlc3 = (rawBar.high + rawBar.low + rawBar.close) / 3;
    const ohlc4 = (rawBar.open + rawBar.high + rawBar.low + rawBar.close) / 4;
    const hlcc4 = (rawBar.high + rawBar.low + rawBar.close + rawBar.close) / 4;

    ohlcv.time.append(rawBar.time);
    ohlcv.open.append(rawBar.open);
    ohlcv.high.append(rawBar.high);
    ohlcv.low.append(rawBar.low);
    ohlcv.close.append(rawBar.close);
    ohlcv.volume.append(rawBar.volume);
    ohlcv.hl2.append(hl2);
    ohlcv.hlc3.append(hlc3);
    ohlcv.ohlc4.append(ohlc4);
    ohlcv.hlcc4.append(hlcc4);

    bar.time = rawBar.time;
    bar.open = rawBar.open;
    bar.high = rawBar.high;
    bar.low = rawBar.low;
    bar.close = rawBar.close;
    bar.volume = rawBar.volume;
    bar.hl2 = hl2;
    bar.hlc3 = hlc3;
    bar.ohlc4 = ohlc4;
    bar.hlcc4 = hlcc4;
    bar.symbol = rawBar.symbol;
    bar.interval = rawBar.interval;

    state.emissions.plots = [];
    state.emissions.drawings = [];
    state.emissions.alerts = [];
    state.emissions.diagnostics = [];
    state.emissions.fromBar = state.barIndex;
    state.emissions.toBar = state.barIndex;

    ACTIVE_RUNTIME_CONTEXT.current = state.runtimeContext;
    state.runtimeContext.isTick = false;
    try {
        await Promise.resolve(state.compute(buildComputeContext(state)));
    } finally {
        ACTIVE_RUNTIME_CONTEXT.current = null;
    }

    state.barIndex += 1;
}
