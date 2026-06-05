// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// No invinite source — semantics per Pine `ta.lowest`. See PLAN.md §3.1.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape.

import type { LowestOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView } from "../seriesView";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue";

type LowestSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly length: number;
    /** Closed source values across the trailing `length` bars. */
    readonly sourceWindow: Float64RingBuffer;
    /** Monotone-increasing values front-to-back (front = current min). */
    monoIndices: number[];
    monoValues: number[];
    barCount: number;
    /**
     * Min of the trailing window EXCLUDING the head bar. Computed once
     * per close by walking the source window.
     */
    closedMinExcludingHead: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.lowest called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, capacity: number): LowestSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        length,
        sourceWindow: new Float64RingBuffer(length),
        monoIndices: [],
        monoValues: [],
        barCount: 0,
        closedMinExcludingHead: Number.POSITIVE_INFINITY,
    };
}

function recomputeMinExcludingHead(slot: LowestSlot): number {
    let minV = Number.POSITIVE_INFINITY;
    const filled = slot.sourceWindow.length;
    for (let i = 1; i < filled; i += 1) {
        const v = slot.sourceWindow.at(i);
        if (Number.isFinite(v) && v < minV) minV = v;
    }
    return minV;
}

function closeValue(slot: LowestSlot, src: number): number {
    slot.barCount += 1;
    const headIndex = slot.barCount - 1;
    slot.sourceWindow.append(src);

    const oldestAllowed = headIndex - slot.length + 1;
    while (slot.monoIndices.length > 0 && slot.monoIndices[0] < oldestAllowed) {
        slot.monoIndices.shift();
        slot.monoValues.shift();
    }

    if (Number.isFinite(src)) {
        // Strict `>` keeps equal values in the deque.
        while (slot.monoIndices.length > 0 && slot.monoValues[slot.monoValues.length - 1] > src) {
            slot.monoIndices.pop();
            slot.monoValues.pop();
        }
        slot.monoIndices.push(headIndex);
        slot.monoValues.push(src);
    }

    if (slot.barCount < slot.length) {
        slot.closedMinExcludingHead = Number.POSITIVE_INFINITY;
        return Number.NaN;
    }

    slot.closedMinExcludingHead = recomputeMinExcludingHead(slot);

    if (slot.monoIndices.length === 0) return Number.NaN;
    return slot.monoValues[0];
}

function tickValue(slot: LowestSlot, src: number): number {
    if (slot.barCount < slot.length) return Number.NaN;
    if (!Number.isFinite(src)) {
        return slot.closedMinExcludingHead === Number.POSITIVE_INFINITY
            ? Number.NaN
            : slot.closedMinExcludingHead;
    }
    if (slot.closedMinExcludingHead === Number.POSITIVE_INFINITY) {
        return src;
    }
    return Math.min(slot.closedMinExcludingHead, src);
}

/**
 * Rolling minimum of the last `length` source values. NaN inputs are
 * skipped from the window; the output is NaN until `length` closed
 * bars have been folded in. Tick-mode replays the head as
 * `min(closedMinExcludingHead, tickValue)`.
 *
 * @formula  out[t] = min(source[t − length + 1 .. t])  (NaN slots skipped)
 * @warmup   length − 1
 * @since 0.2
 * @experimental
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const lower = ta.lowest(bar.low, 20);
 *     // plot(lower);
 */
export function lowest(
    slotId: string,
    source: ScalarOrSeries,
    length: number,
    _opts?: LowestOpts,
): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as LowestSlot | undefined;
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
