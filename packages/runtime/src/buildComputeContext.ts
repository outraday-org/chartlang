// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ComputeContext } from "@invinite-org/chartlang-core";

import type { RunnerState } from "./createScriptRunner";
import { alert, hline, plot, ta } from "./primitives";

const EMPTY_INPUTS: Readonly<Record<string, unknown>> = Object.freeze({});

/**
 * Build the `ComputeContext` the runner hands the compiled script on
 * every step. Phase 1 returns the runtime's stable `BarView` (identity
 * preserved across bars per PLAN §6.7), a frozen empty `inputs` record
 * (Phase-4 wires `input.*` resolution), and the runtime's throw-stub
 * `ta` / `plot` / `hline` / `alert` exports — Tasks 7-8 replace those
 * with the real implementations, so the destructure pattern stays
 * stable across phases.
 *
 * The `bar` field is the mutable `BarView` typed-narrowed to the
 * readonly `Bar` surface the script sees. Identity is stable, so a
 * `const { bar } = ctx` at the top of `compute` keeps seeing the live
 * scalars without re-binding per bar.
 *
 * @since 0.1
 * @example
 *     // import { buildComputeContext } from "@invinite-org/chartlang-runtime";
 *     // const ctx = buildComputeContext(state);
 *     // void ctx.bar.close;
 */
export function buildComputeContext(state: RunnerState): ComputeContext {
    return {
        bar: state.mainStream.bar,
        inputs: EMPTY_INPUTS,
        ta,
        plot,
        hline,
        alert,
    };
}
