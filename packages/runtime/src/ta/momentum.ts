// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/momentum.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.

import type { MomentumOpts, Series } from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { change } from "./change";
import type { ScalarOrSeries } from "./lib/sourceValue";

type MomentumSlot = {
    series: Series<number> | null;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.momentum called outside an active script step");
    }
    return ctx;
}

/**
 * Momentum (Pine `mom`) — first-difference `source[0] − source[length]`
 * with a required `length`. Composes {@link change} via a sub-slot so
 * the math kernel lives in one place; the returned `Series<number>` is
 * the sub-slot's series view directly (parent slot just caches its
 * identity for `===`-stable reads). Warmup is `length` bars.
 *
 * @formula  out[t] = source[t] − source[t − length]
 * @warmup   length
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const m = ta.momentum("slot", bar.close, 10);
 *     // const head = m.current;
 */
export function momentum(
    slotId: string,
    source: ScalarOrSeries,
    length: number,
    _opts?: MomentumOpts,
): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as MomentumSlot | undefined;
    if (slot === undefined) {
        slot = { series: null };
        ctx.stream.taSlots.set(slotId, slot);
    }
    const sub = change(`${slotId}/change`, source, { length });
    if (slot.series === null) slot.series = sub;
    return slot.series;
}
