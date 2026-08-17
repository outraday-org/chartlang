// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { buildComputeContext } from "../buildComputeContext.js";
import type { RunnerState } from "../createScriptRunner.js";
import { resetSubIdCounters } from "../emit/draw/index.js";
import { foldConfirmedOrders, isRuntimeErrorHalt, pushDiagnostic } from "../emit/index.js";
import { ACTIVE_RUNTIME_CONTEXT } from "../runtimeContext.js";
import {
    advanceObjectSeriesSlots,
    advanceSeriesSlots,
    commitArraySlots,
    commitMapSlots,
    commitObjectSeriesSlots,
    commitSeriesSlots,
    commitStateSlots,
    flushStateSlots,
    resetObjectSeriesHeads,
    resetSeriesHeads,
    resetTentativeArraySlots,
    resetTentativeMapSlots,
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
    state.emissions.orders = [];
    state.emissions.logs = [];
    state.emissions.diagnostics = [];
    state.emissions.fromBar = state.barIndex;
    state.emissions.toBar = state.barIndex;
    // `pendingOrders` is per-STEP, like the queues above: it holds only the
    // orders this step accepted onto the wire, which is what lets the
    // confirmed-step fold read it without filtering.
    state.runtimeContext.pendingOrders = [];
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
 * On a **confirmed** step (`history` / `close`) that neither halted nor lost a
 * dep, the tail folds the step's accepted `order.*` intents into the runner's
 * nominal position and auto-renders their markers — see the comment at the
 * call site for why each suppressing condition is there.
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
            resetObjectSeriesHeads(state.runtimeContext);
            resetTentativeArraySlots(state.runtimeContext);
            resetTentativeMapSlots(state.runtimeContext);
        } else {
            // Advance every already-allocated series ring with a fresh
            // sentinel head (NaN for numeric, `false`/`""` for non-numeric)
            // BEFORE compute, so a slot first allocated mid-compute (it
            // already holds its seeded head) is not double-advanced.
            advanceSeriesSlots(state.runtimeContext);
            advanceObjectSeriesSlots(state.runtimeContext);
        }
        refreshRuntimeViews(state, eventKind);
        try {
            await Promise.resolve(state.compute(buildComputeContext(state)));
            if (!isTick) {
                commitStateSlots(state.runtimeContext);
                flushStateSlots(state.runtimeContext);
                commitSeriesSlots(state.runtimeContext);
                commitObjectSeriesSlots(state.runtimeContext);
                commitArraySlots(state.runtimeContext);
                commitMapSlots(state.runtimeContext);
            }
        } catch (err) {
            if (!isRuntimeErrorHalt(err)) throw err;
            state.emissions.plots = [];
            state.emissions.drawings = [];
            state.emissions.alerts = [];
            state.emissions.alertConditions = [];
            // Orders are signals rather than visuals, which is why they survive
            // DEDUP — but that framing buys them nothing against a HALT: a
            // halted bar's intents are not trustworthy, so they are discarded
            // with the visual queues, and `pendingOrders` goes with them or the
            // position would fold an order that never reached the wire.
            state.emissions.orders = [];
            state.runtimeContext.pendingOrders = [];
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
    // THE confirmed-step fold seam (RFC 0002 §7). Runs per runner — primary,
    // dep and sibling all drive their compute through this one function — so
    // each runner's `order.position()` matches its own emitted stream. Two
    // suppressing conditions, and one that needs no term:
    //   - `isTick`: ticks are REPLACED, not accumulated, so a folding tick would
    //     double-apply the moment the head bar is re-ticked. The intents still
    //     reached the wire; only the position stands still.
    //   - `depErroredThisBar`: `clearVisualEmissions` runs in `onBarClose` /
    //     `onBarTick` AFTER this function returns, so folding first would apply
    //     orders that never reach the wire. (Sub-runner states never set it.)
    //   - a HALT needs no term: the catch arm above already emptied
    //     `pendingOrders`, which makes the fold a no-op by construction.
    // Deliberately OUTSIDE the `finally`: the fold takes its context explicitly
    // and must not resurrect `ACTIVE_RUNTIME_CONTEXT`.
    if (!isTick && !state.depErroredThisBar) {
        foldConfirmedOrders(state.runtimeContext);
    }
    return outcome;
}
