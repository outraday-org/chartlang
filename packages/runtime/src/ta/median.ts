// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/median.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. Only the median-statistic line is ported;
// invinite's median plugin also bundles ±ATR bands + an EMA-smoothed
// median line — those compositions are out of scope for the single-
// output `ta.median` primitive (script authors compose them via
// `ta.atr`, `ta.ema` as needed).

import type { MedianOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView } from "../seriesView.js";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue.js";

type MedianSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly length: number;
    /**
     * Closed source values across the trailing `length` bars (capacity
     * `length`). `at(0)` is the head — most recent close — and
     * `at(length - 1)` is the oldest.
     */
    readonly window: Float64RingBuffer;
    /**
     * Reused scratch buffer for the per-bar sort. Capacity = `length`.
     * Only the first `k` slots (count of finite values in the window)
     * are populated + sorted per emission.
     */
    readonly sortedBuffer: Float64Array;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.median called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, capacity: number): MedianSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        length,
        window: new Float64RingBuffer(length),
        sortedBuffer: new Float64Array(length),
    };
}

/**
 * Compute the median of the window's finite values. Substitutes
 * `headOverride` for the head slot (age 0) when finite — used by
 * tick replay to evaluate the partial-bar tick without mutating
 * the closed window.
 *
 * Returns `NaN` when the window contains no finite values.
 */
function medianOfWindow(slot: MedianSlot, headOverride: number): number {
    const buf = slot.sortedBuffer;
    let k = 0;
    const filled = slot.window.length;
    for (let i = 0; i < filled; i += 1) {
        const v = i === 0 ? headOverride : slot.window.at(i);
        if (Number.isFinite(v)) {
            buf[k] = v;
            k += 1;
        }
    }
    if (k === 0) return Number.NaN;
    // Sort only the populated prefix — `Float64Array.prototype.sort`
    // takes a comparator but here we slice a typed subarray view.
    const view = buf.subarray(0, k);
    view.sort();
    if (k % 2 === 1) return view[(k - 1) >> 1];
    return (view[(k >> 1) - 1] + view[k >> 1]) / 2;
}

function closeValue(slot: MedianSlot, src: number): number {
    slot.window.append(src);
    if (slot.window.length < slot.length) return Number.NaN;
    return medianOfWindow(slot, slot.window.at(0));
}

function tickValue(slot: MedianSlot, src: number): number {
    if (slot.window.length < slot.length) return Number.NaN;
    return medianOfWindow(slot, src);
}

/**
 * Rolling median — middle-value statistic across the trailing
 * `length` source values. NaN slots are dropped from the sort
 * (window length effectively shrinks); if every slot is NaN the
 * output is NaN. Robust to single-bar spikes the way an SMA isn't.
 * Tick-mode replays the head by substituting the tick value for
 * the age-0 slot before sorting — the closed window is unchanged.
 *
 * @formula  out[t] = median(source[t − length + 1 .. t]) ;
 *           odd length → middle value ; even length → mean of the
 *           two middle values ; NaN slots dropped before sort
 * @warmup   length − 1
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const m = ta.median(bar.close, 21);
 *     // plot(m);
 */
export function median(
    slotId: string,
    source: ScalarOrSeries,
    length: number,
    _opts?: MedianOpts,
): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as MedianSlot | undefined;
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
