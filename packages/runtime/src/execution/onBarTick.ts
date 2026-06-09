// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";

import { buildComputeContext } from "../buildComputeContext";
import type { RunnerState } from "../createScriptRunner";
import { isRuntimeErrorHalt, pushDiagnostic } from "../emit";
import { resetSubIdCounters } from "../emit/draw";
import { ACTIVE_RUNTIME_CONTEXT } from "../runtimeContext";
import { resetTentativeStateSlots } from "../state";
import { replaceTickHead, updateFallbackViewport } from "../streamState";
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
    replaceTickHead(state.mainStream, rawBar);
    updateFallbackViewport(state.mainStream);

    state.emissions.plots = [];
    state.emissions.drawings = [];
    state.emissions.alerts = [];
    state.emissions.alertConditions = [];
    state.emissions.logs = [];
    state.emissions.diagnostics = [];
    state.emissions.fromBar = state.barIndex;
    state.emissions.toBar = state.barIndex;
    state.runtimeContext.requestSecurityAlignments.clear();
    state.runtimeContext.requestSecurityAscendingBars.clear();
    state.runtimeContext.logBudget = 0;
    state.runtimeContext.logBudgetExceededDiagnosed = false;

    ACTIVE_RUNTIME_CONTEXT.current = state.runtimeContext;
    state.runtimeContext.isTick = true;
    try {
        resetSubIdCounters(state.runtimeContext);
        resetTentativeStateSlots(state.runtimeContext);
        refreshRuntimeViews(state, "tick");
        try {
            await Promise.resolve(state.compute(buildComputeContext(state)));
        } catch (err) {
            if (!isRuntimeErrorHalt(err)) throw err;
            state.emissions.plots = [];
            state.emissions.drawings = [];
            state.emissions.alerts = [];
            state.emissions.alertConditions = [];
            state.emissions.logs = [];
            pushDiagnostic(state.emissions, {
                kind: "diagnostic",
                severity: "error",
                code: "runtime-error-thrown",
                message: err.message,
                slotId: null,
                bar: state.barIndex,
            });
        }
    } finally {
        state.runtimeContext.isTick = false;
        ACTIVE_RUNTIME_CONTEXT.current = null;
    }
}
