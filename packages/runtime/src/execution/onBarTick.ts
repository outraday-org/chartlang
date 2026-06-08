// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";

import { buildComputeContext } from "../buildComputeContext";
import type { RunnerState } from "../createScriptRunner";
import { resetSubIdCounters } from "../emit/draw";
import { ACTIVE_RUNTIME_CONTEXT } from "../runtimeContext";
import { resetTentativeStateSlots } from "../state";
import { refreshRuntimeViews } from "../views";

/**
 * §6.7 tick path. Replaces the head slot on every close-side OHLCV
 * buffer (close / high / low / volume / derived sources) — does NOT
 * advance the buffer length. `time` and `open` are NOT replaced: ticks
 * happen within the in-progress bar whose open time was set on the
 * preceding `onBarClose`.
 *
 * The runtime exposes `state.runtimeContext.isTick = true` for the
 * duration of `compute`. Task 7 stateful primitives read this flag to
 * switch between `append` and `replaceHead` slot updates. `isTick` is
 * reset to `false` in the finally block regardless of compute outcome.
 *
 * `state.barIndex` is NOT incremented — consecutive ticks share the
 * in-progress bar's index.
 *
 * @since 0.1
 * @example
 *     // import { onBarTick } from "@invinite-org/chartlang-runtime";
 *     // await onBarTick(state, tickBar);
 */
export async function onBarTick(state: RunnerState, rawBar: Bar): Promise<void> {
    const { ohlcv, bar } = state.mainStream;
    const hl2 = (rawBar.high + rawBar.low) / 2;
    const hlc3 = (rawBar.high + rawBar.low + rawBar.close) / 3;
    const ohlc4 = (rawBar.open + rawBar.high + rawBar.low + rawBar.close) / 4;
    const hlcc4 = (rawBar.high + rawBar.low + rawBar.close + rawBar.close) / 4;

    ohlcv.close.replaceHead(rawBar.close);
    ohlcv.high.replaceHead(rawBar.high);
    ohlcv.low.replaceHead(rawBar.low);
    ohlcv.volume.replaceHead(rawBar.volume);
    ohlcv.hl2.replaceHead(hl2);
    ohlcv.hlc3.replaceHead(hlc3);
    ohlcv.ohlc4.replaceHead(ohlc4);
    ohlcv.hlcc4.replaceHead(hlcc4);

    bar.close = rawBar.close;
    bar.high = rawBar.high;
    bar.low = rawBar.low;
    bar.volume = rawBar.volume;
    bar.hl2 = hl2;
    bar.hlc3 = hlc3;
    bar.ohlc4 = ohlc4;
    bar.hlcc4 = hlcc4;

    state.emissions.plots = [];
    state.emissions.drawings = [];
    state.emissions.alerts = [];
    state.emissions.diagnostics = [];
    state.emissions.fromBar = state.barIndex;
    state.emissions.toBar = state.barIndex;

    ACTIVE_RUNTIME_CONTEXT.current = state.runtimeContext;
    state.runtimeContext.isTick = true;
    try {
        resetSubIdCounters(state.runtimeContext);
        resetTentativeStateSlots(state.runtimeContext);
        refreshRuntimeViews(state, "tick");
        await Promise.resolve(state.compute(buildComputeContext(state)));
    } finally {
        state.runtimeContext.isTick = false;
        ACTIVE_RUNTIME_CONTEXT.current = null;
    }
}
