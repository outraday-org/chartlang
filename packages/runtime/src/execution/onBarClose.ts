// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";

import { buildComputeContext } from "../buildComputeContext";
import type { RunnerState } from "../createScriptRunner";
import { isRuntimeErrorHalt, pushDiagnostic } from "../emit";
import { resetSubIdCounters } from "../emit/draw";
import { ACTIVE_RUNTIME_CONTEXT } from "../runtimeContext";
import { commitStateSlots, flushStateSlots } from "../state";
import { appendBarToStream, updateFallbackViewport } from "../streamState";
import { type EventKind, refreshRuntimeViews } from "../views";

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
export async function onBarClose(
    state: RunnerState,
    rawBar: Bar,
    eventKind: EventKind = "close",
): Promise<void> {
    appendBarToStream(state.mainStream, rawBar);
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
    state.runtimeContext.isTick = false;
    try {
        resetSubIdCounters(state.runtimeContext);
        refreshRuntimeViews(state, eventKind);
        try {
            await Promise.resolve(state.compute(buildComputeContext(state)));
            commitStateSlots(state.runtimeContext);
            flushStateSlots(state.runtimeContext);
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
        ACTIVE_RUNTIME_CONTEXT.current = null;
    }

    state.barIndex += 1;
}
