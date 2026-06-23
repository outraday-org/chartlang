// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ComputeContext } from "@invinite-org/chartlang-core";

import type { RunnerState } from "./createScriptRunner.js";
import { alert, barcolor, bgcolor, draw, hline, plot, ta } from "./primitives.js";
import { emitAlertCondition } from "./emit/alertConditionEmission.js";
import { buildRuntimeNamespace } from "./emit/logEmission.js";
import { buildRequestNamespace } from "./request/index.js";
import { buildStateNamespace } from "./state/index.js";
import { buildSessionNamespace, buildTimeNamespace } from "./time-accessors/index.js";

/**
 * Build the `ComputeContext` the runner hands the compiled script on
 * every step. Phase 1 returns the runtime's stable `BarView` (identity
 * preserved across bars per PLAN §6.7), the mount-resolved frozen
 * `inputs` record, and the runtime primitive implementations.
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
    const base = {
        bar: state.mainStream.bar,
        inputs: state.runtimeContext.resolvedInputs,
        ta,
        plot,
        hline,
        bgcolor,
        barcolor,
        alert,
        draw,
        state: buildStateNamespace(),
        barstate: state.runtimeContext.views.barstate,
        syminfo: state.runtimeContext.views.syminfo,
        timeframe: state.runtimeContext.views.timeframe,
        time: buildTimeNamespace(state.runtimeContext),
        session: buildSessionNamespace(state.runtimeContext),
        request: buildRequestNamespace(),
        runtime: buildRuntimeNamespace(state.runtimeContext),
    };
    if (state.manifest.kind !== "alertCondition") return base;
    return {
        ...base,
        signal: (conditionId, fired) =>
            emitAlertCondition(state.runtimeContext, conditionId, fired),
    };
}
