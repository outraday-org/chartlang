// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// No invinite source — semantics per Pine `ta.lowestbars`.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape.

import type { LowestbarsOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView } from "../seriesView.js";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue.js";

type LowestbarsSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly length: number;
    /** Closed source values across the trailing `length` bars. */
    readonly sourceWindow: Float64RingBuffer;
    barCount: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.lowestbars called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, capacity: number): LowestbarsSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        length,
        sourceWindow: new Float64RingBuffer(length),
        barCount: 0,
    };
}

/**
 * Bar offset (≤ 0) to the lowest value across the retained window.
 * Walks the window most-recent-first (`at(0)` is the head bar) and
 * updates the running extreme only on a STRICT improvement, so ties
 * keep the most-recent bar (smallest |offset|). `headValue` overrides
 * the head candidate (`at(0)`) for the tick-replay path; pass
 * `undefined` to read the closed head from the window.
 *
 * Returns `NaN` when every candidate in the window is NaN.
 */
function offsetToMin(slot: LowestbarsSlot, headValue: number | undefined): number {
    const filled = slot.sourceWindow.length;
    let bestValue = Number.POSITIVE_INFINITY;
    let bestOffset = Number.NaN;
    for (let i = 0; i < filled; i += 1) {
        const v = i === 0 && headValue !== undefined ? headValue : slot.sourceWindow.at(i);
        if (Number.isFinite(v) && v < bestValue) {
            bestValue = v;
            // `i === 0` ⇒ offset 0 (NOT −0) so `Object.is`-based equality
            // and JSON serialisation never see negative zero.
            bestOffset = i === 0 ? 0 : -i;
        }
    }
    return bestOffset;
}

function closeValue(slot: LowestbarsSlot, src: number): number {
    slot.barCount += 1;
    slot.sourceWindow.append(src);

    if (slot.barCount < slot.length) return Number.NaN;

    return offsetToMin(slot, undefined);
}

function tickValue(slot: LowestbarsSlot, src: number): number {
    if (slot.barCount < slot.length) return Number.NaN;
    return offsetToMin(slot, src);
}

/**
 * Bar offset (≤ 0) to the lowest `source` value over the trailing
 * `length` bars (the window INCLUDES the current bar). `0` means the
 * current bar is the lowest; `-k` means the lowest occurred `k` bars
 * ago. Ties resolve to the MOST RECENT bar (smallest |offset|). NaN
 * inputs are skipped as candidates; an all-NaN window emits NaN. The
 * output is NaN until `length` closed bars have folded in. Tick-mode
 * replays the in-progress head as the offset-0 candidate without
 * advancing the buffer.
 *
 * @formula  out[t] = argmin_{k ∈ [0, length)} source[t − k] expressed as −k
 *           (NaN slots skipped; ties → smallest k)
 * @warmup   length − 1
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const lbar = ta.lowestbars(bar.low, 20);
 *     // const left = bar.point(lbar.current, bar.low.current);
 */
export function lowestbars(
    slotId: string,
    source: ScalarOrSeries,
    length: number,
    _opts?: LowestbarsOpts,
): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as LowestbarsSlot | undefined;
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
