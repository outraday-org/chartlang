// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// No invinite source — semantics per Pine `ta.highest`. See PLAN.md §3.1.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape.

import type { HighestOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView } from "../seriesView.js";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue.js";

type HighestSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly length: number;
    /**
     * Closed source values across the trailing `length` bars (capacity
     * `length`). `at(0)` is the most recent close (the head bar).
     */
    readonly sourceWindow: Float64RingBuffer;
    /**
     * Monotonic-decreasing deque of absolute bar indices in the trailing
     * `length` window. Front = bar index whose source value is the
     * current rolling max.
     */
    monoIndices: number[];
    /** Source value at each retained index — mirrors `monoIndices`. */
    monoValues: number[];
    /** Number of closed bars folded into the slot. */
    barCount: number;
    /**
     * Max of the trailing `length` window EXCLUDING the head bar.
     * Computed once per close by walking the source window. Tick replay
     * reads this directly. `NEGATIVE_INFINITY` when no finite
     * non-head value exists.
     */
    closedMaxExcludingHead: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.highest called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, capacity: number): HighestSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        length,
        sourceWindow: new Float64RingBuffer(length),
        monoIndices: [],
        monoValues: [],
        barCount: 0,
        closedMaxExcludingHead: Number.NEGATIVE_INFINITY,
    };
}

function recomputeMaxExcludingHead(slot: HighestSlot): number {
    // The window holds the last `min(barCount, length)` closed sources;
    // `sourceWindow.at(0)` is the head bar. Walk the non-head entries
    // and find the max of the finite ones.
    let maxV = Number.NEGATIVE_INFINITY;
    const filled = slot.sourceWindow.length;
    for (let i = 1; i < filled; i += 1) {
        const v = slot.sourceWindow.at(i);
        if (Number.isFinite(v) && v > maxV) maxV = v;
    }
    return maxV;
}

function closeValue(slot: HighestSlot, src: number): number {
    slot.barCount += 1;
    const headIndex = slot.barCount - 1;
    slot.sourceWindow.append(src);

    // Evict deque front entries that fell out of the trailing window.
    const oldestAllowed = headIndex - slot.length + 1;
    while (slot.monoIndices.length > 0 && slot.monoIndices[0] < oldestAllowed) {
        slot.monoIndices.shift();
        slot.monoValues.shift();
    }

    if (Number.isFinite(src)) {
        // Maintain monotone-decreasing values from front to back. Pop on
        // strict `<` keeps equal values in the deque so the window can
        // tell when multiple bars share the same max.
        while (slot.monoIndices.length > 0 && slot.monoValues[slot.monoValues.length - 1] < src) {
            slot.monoIndices.pop();
            slot.monoValues.pop();
        }
        slot.monoIndices.push(headIndex);
        slot.monoValues.push(src);
    }
    // NaN sources are not pushed — NaN slots are skipped from the window
    // (matches `ta.highest`'s NaN-skip semantics).

    // Warmup: require at least `length` closed bars before emitting.
    if (slot.barCount < slot.length) {
        slot.closedMaxExcludingHead = Number.NEGATIVE_INFINITY;
        return Number.NaN;
    }

    slot.closedMaxExcludingHead = recomputeMaxExcludingHead(slot);

    if (slot.monoIndices.length === 0) {
        // All NaN in the window.
        return Number.NaN;
    }
    return slot.monoValues[0];
}

function tickValue(slot: HighestSlot, src: number): number {
    // Unwarmed: tick during warmup still NaN.
    if (slot.barCount < slot.length) return Number.NaN;
    if (!Number.isFinite(src)) {
        // NaN tick — treat the head as if its source were NaN; the
        // window's max excludes the head bar.
        return slot.closedMaxExcludingHead === Number.NEGATIVE_INFINITY
            ? Number.NaN
            : slot.closedMaxExcludingHead;
    }
    if (slot.closedMaxExcludingHead === Number.NEGATIVE_INFINITY) {
        // Window-excluding-head has no finite values (e.g. length === 1
        // or every other bar was NaN). The tick value is the only
        // candidate.
        return src;
    }
    return Math.max(slot.closedMaxExcludingHead, src);
}

/**
 * Rolling maximum of the last `length` source values. NaN inputs are
 * skipped from the window; the output is NaN until `length` closed
 * bars have been folded in. Tick-mode replays the head as
 * `max(closedMaxExcludingHead, tickValue)` so partial-bar values do
 * not pollute the next close's deque.
 *
 * @formula  out[t] = max(source[t − length + 1 .. t])  (NaN slots skipped)
 * @warmup   length − 1
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const upper = ta.highest(bar.high, 20);
 *     // plot(upper);
 */
export function highest(
    slotId: string,
    source: ScalarOrSeries,
    length: number,
    _opts?: HighestOpts,
): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as HighestSlot | undefined;
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
