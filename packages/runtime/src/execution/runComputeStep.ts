// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { buildComputeContext } from "../buildComputeContext.js";
import type { RunnerState } from "../createScriptRunner.js";
import { resetSubIdCounters } from "../emit/draw/index.js";
import { isRuntimeErrorHalt, pushDiagnostic } from "../emit/index.js";
import { ACTIVE_RUNTIME_CONTEXT } from "../runtimeContext.js";
import {
    advanceSeriesSlots,
    commitArraySlots,
    commitSeriesSlots,
    commitStateSlots,
    flushStateSlots,
    resetSeriesHeads,
    resetTentativeArraySlots,
    resetTentativeStateSlots,
} from "../state/index.js";
import { type EventKind, refreshRuntimeViews } from "../views/index.js";

/**
 * Outcome of a single compute step. `ok` means the script's `compute`
 * returned normally; `halt` means `runtime.error(...)` was thrown (the
 * compute body deliberately aborted the bar). Non-halt throws propagate
 * out of {@link runComputeStep} unchanged.
 *
 * @since 0.7
 * @stable
 * @example
 *     const r: RunComputeStepOutcome = { kind: "ok" };
 *     void r;
 */
export type RunComputeStepOutcome =
    | Readonly<{ kind: "ok" }>
    | Readonly<{ kind: "halt"; readonly message: string }>;

/**
 * Configuration for {@link runComputeStep}. `eventKind` reaches the
 * runtime views so `barstate.*` picks up the right snapshot; `isTick`
 * discriminates the close-vs-tick state-slot lifecycle.
 *
 * @since 0.7
 * @stable
 * @example
 *     const args = { state, eventKind: "close" as const, isTick: false };
 *     void args;
 */
export type RunComputeStepArgs = Readonly<{
    readonly state: RunnerState;
    readonly eventKind: EventKind;
    readonly isTick: boolean;
}>;

/**
 * Reset the per-bar emission queues on a runner before its compute
 * runs. Exported for the dep / sibling step driver — single-script
 * callers go through {@link runComputeStep} which calls this
 * internally.
 *
 * @since 0.7
 * @stable
 * @example
 *     // resetBarEmissions(state);
 */
export function resetBarEmissions(state: RunnerState): void {
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
    state.runtimeContext.requestSecurityExprSeries?.clear();
    state.runtimeContext.logBudget = 0;
    state.runtimeContext.logBudgetExceededDiagnosed = false;
}

/**
 * Run the inner compute body of `state.compute` — set
 * `ACTIVE_RUNTIME_CONTEXT`, reset sub-id counters, optionally reset
 * tentative state slots, refresh views, invoke `compute`, commit /
 * flush state slots on close. Does NOT reset the per-bar emission
 * queues; callers do that exactly once via {@link resetBarEmissions}.
 *
 * `runtime.error(...)` halts clear the runner's visual emissions and
 * push a `runtime-error-thrown` diagnostic, matching the Phase-1
 * single-script behaviour byte-for-byte. Non-halt throws propagate
 * out unchanged.
 *
 * @since 0.7
 * @stable
 * @example
 *     // const outcome = await runComputeBody({ state, eventKind: "close", isTick: false });
 *     // void outcome;
 */
export async function runComputeBody(args: RunComputeStepArgs): Promise<RunComputeStepOutcome> {
    const { state, eventKind, isTick } = args;
    ACTIVE_RUNTIME_CONTEXT.current = state.runtimeContext;
    state.runtimeContext.isTick = isTick;
    let outcome: RunComputeStepOutcome = { kind: "ok" };
    try {
        resetSubIdCounters(state.runtimeContext);
        if (isTick) {
            resetTentativeStateSlots(state.runtimeContext);
            resetSeriesHeads(state.runtimeContext);
            resetTentativeArraySlots(state.runtimeContext);
        } else {
            // Advance every already-allocated series ring with a fresh NaN
            // head BEFORE compute, so a slot first allocated mid-compute (it
            // already holds its seeded head) is not double-advanced.
            advanceSeriesSlots(state.runtimeContext);
        }
        refreshRuntimeViews(state, eventKind);
        try {
            await Promise.resolve(state.compute(buildComputeContext(state)));
            if (!isTick) {
                commitStateSlots(state.runtimeContext);
                flushStateSlots(state.runtimeContext);
                commitSeriesSlots(state.runtimeContext);
                commitArraySlots(state.runtimeContext);
            }
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
            outcome = { kind: "halt", message: err.message };
        }
    } finally {
        if (isTick) state.runtimeContext.isTick = false;
        ACTIVE_RUNTIME_CONTEXT.current = null;
    }
    return outcome;
}
