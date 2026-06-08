// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";

import type { RunnerState } from "../createScriptRunner";
import { onBarClose } from "./onBarClose";

/**
 * Bulk-fill warmup. Walks `bars` forward and runs `onBarClose` per
 * entry, preserving the §6.4 determinism contract (every bar passes
 * through `compute` in source order). A Phase-2 optimisation could
 * pre-fill ring buffers without re-running compute, but stay correct
 * first.
 *
 * Errors thrown by `compute` propagate immediately — subsequent bars
 * do not run. The host (Task 9) owns containment + reporting.
 *
 * @since 0.1
 * @example
 *     // import { onHistory } from "@invinite-org/chartlang-runtime";
 *     // await onHistory(state, historicalBars);
 */
export async function onHistory(state: RunnerState, bars: ReadonlyArray<Bar>): Promise<void> {
    for (const bar of bars) {
        await onBarClose(state, bar, "history");
    }
}
