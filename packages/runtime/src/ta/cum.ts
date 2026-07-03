// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// No invinite source — semantics per Pine `ta.cum`.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape. The accumulator + tick
// snapshot mirror `ta.obv` / `ta.adl` exactly.

import type { Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView } from "../seriesView.js";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue.js";

type CumSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    /** Running total across the closed bars so far. */
    cum: number;
    /** Snapshot of `cum` BEFORE the most recent close-side update. */
    prevClosedCum: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.cum called outside an active script step");
    }
    return ctx;
}

function initSlot(capacity: number): CumSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        cum: 0,
        prevClosedCum: 0,
    };
}

/**
 * Running (cumulative) sum of `source` from the first bar. A `NaN` sample
 * contributes `0`, carrying the total forward without polluting it
 * (matching Pine `ta.cum` and the `obv` / `adl` accumulator convention).
 *
 * **Tick mode.** Replays the head bar's contribution against a snapshot of
 * the prior-close total (`prevClosedCum`) so a partial-bar tick doesn't
 * pollute the next close's accumulator.
 *
 * @formula  out[t] = Σ_{u=0..t} (isFinite(src[u]) ? src[u] : 0)
 * @warmup   0
 * @since 1.8
 * @stable
 * @example
 *     // const cumVol = ta.cum(bar.volume);
 */
export function cum(slotId: string, source: ScalarOrSeries): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as CumSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const src = readSourceValue(source);
    const contribution = Number.isFinite(src) ? src : 0;

    if (ctx.isTick) {
        slot.outBuffer.replaceHead(slot.prevClosedCum + contribution);
        return slot.series;
    }

    slot.prevClosedCum = slot.cum;
    slot.cum += contribution;
    slot.outBuffer.append(slot.cum);
    return slot.series;
}
