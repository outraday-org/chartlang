// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { RunnerEmissions } from "@invinite-org/chartlang-adapter-kit";

import type { RunnerState } from "../createScriptRunner";

/**
 * Snapshot and reset. Returns the runner's currently-accumulated
 * emissions as a frozen `RunnerEmissions` object, then clears the
 * runner's queues by reassigning each array to a fresh empty array —
 * the adapter holds the snapshot's arrays, the runner gets fresh
 * containers for the next step.
 *
 * A second `drain` immediately after the first returns empty arrays
 * but the same `fromBar` / `toBar` (those are not reset until the next
 * step). The §6.7 invariant 4 ("queues cleared at start of every step")
 * is enforced by `onBarClose` / `onBarTick`, not by `drain`.
 *
 * @since 0.1
 * @example
 *     // import { drain } from "@invinite-org/chartlang-runtime";
 *     // const emissions = drain(state);
 *     // void emissions.plots;
 */
export function drain(state: RunnerState): RunnerEmissions {
    const out: RunnerEmissions = Object.freeze({
        plots: state.emissions.plots,
        drawings: state.emissions.drawings,
        alerts: state.emissions.alerts,
        diagnostics: state.emissions.diagnostics,
        fromBar: state.emissions.fromBar,
        toBar: state.emissions.toBar,
    });
    state.emissions.plots = [];
    state.emissions.drawings = [];
    state.emissions.alerts = [];
    state.emissions.diagnostics = [];
    return out;
}
