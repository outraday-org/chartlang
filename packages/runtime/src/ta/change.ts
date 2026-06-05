// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// No invinite source — semantics per Pine `ta.change`. See PLAN.md §3.1.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape.

import type { ChangeOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView } from "../seriesView";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue";

type ChangeSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly length: number;
    /**
     * Closed-bar source values across the last `length + 1` bars. The
     * head (`at(0)`) is the most recent close; `at(length)` is the
     * lookback target the difference is taken against.
     */
    readonly sourceWindow: Float64RingBuffer;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.change called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, capacity: number): ChangeSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        length,
        sourceWindow: new Float64RingBuffer(length + 1),
    };
}

function closeValue(slot: ChangeSlot, src: number): number {
    slot.sourceWindow.append(src);
    if (slot.sourceWindow.length <= slot.length) return Number.NaN;
    const head = slot.sourceWindow.at(0);
    const old = slot.sourceWindow.at(slot.length);
    if (!Number.isFinite(head) || !Number.isFinite(old)) return Number.NaN;
    return head - old;
}

function tickValue(slot: ChangeSlot, src: number): number {
    // Tick replaces the head bar's source. Warmup count is based on
    // CLOSED bars in the window, not tick activity — so an unwarmed
    // slot returns NaN.
    if (slot.sourceWindow.length <= slot.length) return Number.NaN;
    // The bar `length` ago relative to the tick is the same bar that
    // was `length` ago relative to the most recent close (the lookback
    // history doesn't change mid-bar).
    const old = slot.sourceWindow.at(slot.length);
    if (!Number.isFinite(src) || !Number.isFinite(old)) return Number.NaN;
    return src - old;
}

/**
 * First-difference of the source: `source[0] − source[length]`.
 * `opts.length` defaults to `1` (one-bar delta). NaN in either operand
 * propagates to a NaN output. Warmup is `length` bars.
 *
 * @formula  out[t] = source[t] − source[t − length]
 * @warmup   length
 * @since 0.2
 * @experimental
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const delta = ta.change(bar.close, { length: 5 });
 *     // plot(delta);
 */
export function change(slotId: string, source: ScalarOrSeries, opts?: ChangeOpts): Series<number> {
    const ctx = getCtx();
    const length = opts?.length ?? 1;
    let slot = ctx.stream.taSlots.get(slotId) as ChangeSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(length, ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const src = readSourceValue(source);
    if (ctx.isTick) {
        slot.outBuffer.replaceHead(tickValue(slot, src));
    } else {
        slot.outBuffer.append(closeValue(slot, src));
    }
    return slot.series;
}
