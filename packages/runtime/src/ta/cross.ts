// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// No invinite source — semantics per Pine `ta.cross`.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape. `cross` composes the
// registered `crossover` / `crossunder` via sub-slot ids
// `${slotId}/over` / `${slotId}/under` (the `aroonOsc` seam), so a fix
// to either one-direction cross flows in for free — there is no private
// cross math here.

import type { Series } from "@invinite-org/chartlang-core";

import { RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView } from "../seriesView.js";
import { crossover } from "./crossover.js";
import { crossunder } from "./crossunder.js";
import type { ScalarOrSeries } from "./lib/sourceValue.js";

type CrossSlot = {
    readonly outBuffer: RingBuffer<boolean>;
    readonly series: Series<boolean>;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.cross called outside an active script step");
    }
    return ctx;
}

function initSlot(capacity: number): CrossSlot {
    const outBuffer = new RingBuffer<boolean>(capacity);
    return {
        outBuffer,
        series: makeSeriesView<boolean>(outBuffer) as Series<boolean>,
    };
}

/**
 * `true` on the bar where `a` crosses `b` in either direction — the union
 * of `ta.crossover(a, b)` and `ta.crossunder(a, b)`. A `NaN` operand in
 * the one-bar window yields `false`.
 *
 * @formula  out[t] = crossover(a,b)[t] ∨ crossunder(a,b)[t]
 * @warmup   1
 * @since 1.8
 * @stable
 * @example
 *     // const touched = ta.cross(ta.ema(bar.close, 9), ta.ema(bar.close, 21));
 */
export function cross(slotId: string, a: ScalarOrSeries, b: ScalarOrSeries): Series<boolean> {
    const ctx = getCtx();
    // Compose the two registered one-direction crosses at derived sub-slot
    // ids — they own their own tick replay (append/replaceHead on the same
    // `ctx.isTick` flag), so the parent just re-reads `.current` and ORs.
    const over = crossover(`${slotId}/over`, a, b);
    const under = crossunder(`${slotId}/under`, a, b);

    let slot = ctx.stream.taSlots.get(slotId) as CrossSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const out = over.current || under.current;
    if (ctx.isTick) {
        slot.outBuffer.replaceHead(out);
    } else {
        slot.outBuffer.append(out);
    }
    return slot.series;
}
