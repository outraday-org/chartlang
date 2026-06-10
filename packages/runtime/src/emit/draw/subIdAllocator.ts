// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { RuntimeContext } from "../../runtimeContext.js";

/**
 * Return the next sub-id for a given compiler-injected `slotId` within
 * the current bar, then increment the counter. The first call inside a
 * bar yields `0`; the N-th call at the same callsite yields `N-1`.
 *
 * A script's `for (let i = 0; i < N; i++) draw.text(...)` loop produces
 * N stable handles keyed `<slotId>#0` ... `<slotId>#N-1`.
 * {@link resetSubIdCounters} clears every counter at the top of every
 * `onBarClose` / `onBarTick`, so iteration `i` across bars at the same
 * callsite yields the same sub-id — that's the cross-bar handle
 * stability contract from PLAN.md §10.3.
 *
 * @since 0.3
 * @stable
 * @example
 *     // import { nextSubId } from "@invinite-org/chartlang-runtime";
 *     // const subId = nextSubId(ctx, "demo.chart.ts:5:13#0");
 */
export function nextSubId(ctx: RuntimeContext, slotId: string): number {
    const counters = ctx.drawingSubIdCounters;
    const current = counters.get(slotId) ?? 0;
    counters.set(slotId, current + 1);
    return current;
}

/**
 * Clear every sub-id counter on the context. Called by the execution
 * loop at the top of `onBarClose` and `onBarTick` so callsite iteration
 * order is identical across bars — handles allocated by iteration `i`
 * in bar `N` and bar `N+1` share the same `slotId#i`.
 *
 * @since 0.3
 * @stable
 * @example
 *     // import { resetSubIdCounters } from "@invinite-org/chartlang-runtime";
 *     // resetSubIdCounters(ctx);
 */
export function resetSubIdCounters(ctx: RuntimeContext): void {
    ctx.drawingSubIdCounters.clear();
}
