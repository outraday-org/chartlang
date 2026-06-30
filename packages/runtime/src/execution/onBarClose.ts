// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";

import type { RunnerState } from "../createScriptRunner.js";
import { runDepStep, runSiblingStep } from "../dep/index.js";
import { advanceExternalSeriesFeeds } from "../inputs/externalSeriesFeeds.js";
import { appendBarToStream, updateFallbackViewport } from "../streamState.js";
import type { EventKind } from "../views/index.js";
import { resetBarEmissions, runComputeBody } from "./runComputeStep.js";

function clearVisualEmissions(state: RunnerState): void {
    state.emissions.plots = [];
    state.emissions.drawings = [];
    state.emissions.alerts = [];
    state.emissions.alertConditions = [];
    state.emissions.logs = [];
}

/**
 * §6.7 main step. Appends every OHLCV ring buffer, mutates the runner's
 * shared `BarView` in place, walks the bundle's dep + sibling sub-runners
 * (no-op for single-script callers), then runs the primary's `compute`.
 * If any dep halted this bar, the primary's plot / drawing / alert / log
 * queues are dropped (diagnostics stay).
 *
 * The four §6.7 invariants hold at the end of the primary's compute.
 * `barIndex` advances exactly once per close. Errors thrown by `compute`
 * propagate out of `onBarClose`; the host (Task 9) owns containment.
 *
 * @since 0.1 — extended to walk dep + sibling sub-runners in 0.7.
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
    advanceExternalSeriesFeeds(
        state.runtimeContext.externalSeriesSlots,
        state.runtimeContext.externalSeriesFeeds,
        state.barIndex,
        false,
    );
    updateFallbackViewport(state.mainStream);

    state.depErroredThisBar = false;
    resetBarEmissions(state);
    state.depOutputStore?.beginBar();

    for (const dep of state.depRunners) {
        await runDepStep(dep, state, rawBar, eventKind, false);
    }
    for (const sibling of state.siblingRunners) {
        await runSiblingStep(sibling, state, rawBar, eventKind, false);
    }

    await runComputeBody({ state, eventKind, isTick: false });

    if (state.depErroredThisBar) {
        clearVisualEmissions(state);
    }

    state.barIndex += 1;
}
