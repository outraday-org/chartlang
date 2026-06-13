// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";

import type { RunnerState } from "../createScriptRunner.js";
import { runDepStep, runSiblingStep } from "../dep/index.js";
import { replaceTickHead, updateFallbackViewport } from "../streamState.js";
import { resetBarEmissions, runComputeBody } from "./runComputeStep.js";

function clearVisualEmissions(state: RunnerState): void {
    state.emissions.plots = [];
    state.emissions.drawings = [];
    state.emissions.alerts = [];
    state.emissions.alertConditions = [];
    state.emissions.logs = [];
}

/**
 * §6.7 tick path. Replaces the head slot on every close-side OHLCV
 * buffer — does NOT advance the buffer length. `time` and `open` are
 * NOT replaced. Walks the bundle's dep + sibling sub-runners (no-op for
 * single-script callers) before driving the primary's `compute`.
 *
 * `state.barIndex` is NOT incremented — consecutive ticks share the
 * in-progress bar's index.
 *
 * @since 0.1 — extended to walk dep + sibling sub-runners in 0.7.
 * @example
 *     // import { onBarTick } from "@invinite-org/chartlang-runtime";
 *     // await onBarTick(state, tickBar);
 */
export async function onBarTick(state: RunnerState, rawBar: Bar): Promise<void> {
    replaceTickHead(state.mainStream, rawBar);
    updateFallbackViewport(state.mainStream);

    state.depErroredThisBar = false;
    resetBarEmissions(state);
    state.depOutputStore?.beginBar();

    for (const dep of state.depRunners) {
        await runDepStep(dep, state, rawBar, "tick", true);
    }
    for (const sibling of state.siblingRunners) {
        await runSiblingStep(sibling, state, rawBar, "tick", true);
    }

    await runComputeBody({ state, eventKind: "tick", isTick: true });

    if (state.depErroredThisBar) {
        clearVisualEmissions(state);
    }
}
