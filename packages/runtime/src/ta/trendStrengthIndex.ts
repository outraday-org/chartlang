// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/trend-strength-index.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. Named `trendStrengthIndex` to disambiguate
// from the existing `ta.tsi` (Task 14 momentum True Strength Index).
// The math is TradingView's documented Pearson-of-price-vs-bar-index
// formulation — `lib/pearson.ts` (Task 4) is the reference helper.

import type { Series, TrendStrengthIndexOpts } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView, makeShiftedSeriesView } from "../seriesView.js";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue.js";

type TrendStrengthIndexSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly length: number;
    /** Rolling window of recent source values, most-recent first
     * (`at(0)` = head, `at(length - 1)` = oldest). */
    readonly sourceWindow: Float64RingBuffer;
    /** Number of CLOSED bars folded into the slot so far. */
    barCount: number;
    /** Number of NaN values currently in the window — when > 0 the
     * Pearson denominator is undefined and the primitive emits NaN. */
    nanCount: number;
    /** The source value evicted on the current close (the tail value
     * popped when the window was full at append time). Used by tick
     * replay to restore the window to its pre-close state. */
    evictedSource: number;
    /** `nanCount` AS OF THE PRIOR CLOSE — restored by tick replay
     * before substituting the tick's contribution. */
    prevClosedNanCount: number;
    readonly shiftedViews: Map<number, Series<number>>;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.trendStrengthIndex called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, capacity: number): TrendStrengthIndexSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        length,
        sourceWindow: new Float64RingBuffer(length),
        barCount: 0,
        nanCount: 0,
        evictedSource: Number.NaN,
        prevClosedNanCount: 0,
        shiftedViews: new Map(),
    };
}

function viewForOffset(slot: TrendStrengthIndexSlot, offset: number): Series<number> {
    if (offset === 0) return slot.series;
    let view = slot.shiftedViews.get(offset);
    if (view === undefined) {
        view = makeShiftedSeriesView<number>(slot.outBuffer, offset);
        slot.shiftedViews.set(offset, view);
    }
    return view;
}

/**
 * Compute Pearson correlation between the trailing source window and a
 * matching length-`n` linear bar-index series `[0, 1, ..., n-1]`.
 * Mirrors `lib/pearson.ts`'s two-pass mean/covariance formulation
 * exactly (sum then mean, then per-slot deviations) so the property
 * test's full-recompute reference and the incremental head agree
 * within Float64 noise. Returns NaN if any slot is non-finite or the
 * source-side window variance is exactly zero.
 */
function pearsonHead(window: Float64RingBuffer, length: number, headSource: number): number {
    let sumX = 0;
    let sumY = 0;
    for (let k = 0; k < length; k += 1) {
        const x = k === length - 1 ? headSource : window.at(length - 1 - k);
        // Defensive: callers gate on `nanCount === 0` so every window
        // slot is finite when we get here; the `headSource` is also
        // guarded upstream.
        /* c8 ignore next */
        if (!Number.isFinite(x)) return Number.NaN;
        sumX += x;
        sumY += k;
    }
    const meanX = sumX / length;
    const meanY = sumY / length;
    let sumXY = 0;
    let sumXX = 0;
    let sumYY = 0;
    for (let k = 0; k < length; k += 1) {
        const x = k === length - 1 ? headSource : window.at(length - 1 - k);
        const dX = x - meanX;
        const dY = k - meanY;
        sumXY += dX * dY;
        sumXX += dX * dX;
        sumYY += dY * dY;
    }
    if (sumXX === 0 || sumYY === 0) return Number.NaN;
    const r = sumXY / Math.sqrt(sumXX * sumYY);
    if (r < -1) return -1;
    if (r > 1) return 1;
    return r;
}

function closeStep(slot: TrendStrengthIndexSlot, src: number): number {
    slot.prevClosedNanCount = slot.nanCount;

    // Update the rolling window. If the window is full, the tail
    // (oldest) value is about to be evicted by `append` — capture it
    // and adjust the NaN count.
    if (slot.sourceWindow.length >= slot.length) {
        slot.evictedSource = slot.sourceWindow.at(slot.length - 1);
        if (Number.isNaN(slot.evictedSource)) slot.nanCount -= 1;
    } else {
        slot.evictedSource = Number.NaN;
    }
    slot.sourceWindow.append(src);
    if (!Number.isFinite(src)) slot.nanCount += 1;

    slot.barCount += 1;

    if (slot.barCount < slot.length) return Number.NaN;
    if (slot.nanCount > 0) return Number.NaN;
    return pearsonHead(slot.sourceWindow, slot.length, src);
}

function tickStep(slot: TrendStrengthIndexSlot, src: number): number {
    if (slot.barCount < slot.length) return Number.NaN;
    // Re-derive NaN count: start from the prior closed count,
    // un-account for the value evicted by the current close, and
    // account for the tick's substituted value at age 0.
    let nanCount = slot.prevClosedNanCount;
    // Defensive: `evictedSource` is only NaN when the close-side advance
    // evicted a NaN, requiring an earlier NaN bar in the stream that
    // we then tick on. Reachable but rare.
    /* c8 ignore next */
    if (Number.isNaN(slot.evictedSource)) nanCount -= 1;
    if (!Number.isFinite(src)) nanCount += 1;
    if (nanCount > 0) return Number.NaN;
    return pearsonHead(slot.sourceWindow, slot.length, src);
}

/**
 * Trend Strength Index — Pearson correlation between `source` and the
 * bar index over each trailing `length`-bar window. Bounded `[-1, +1]`:
 * `+1` = clean uptrend (price rises monotonically with bar index), `−1`
 * = clean downtrend, `0` = no linear trend. Distinct from
 * `ta.tsi` (the True Strength Index — a momentum oscillator).
 * The math is TradingView's documented Trend Strength Index
 * (https://www.tradingview.com/support/solutions/43000730926-trend-strength-index/).
 *
 * Default `length = 20` per chartlang task spec (invinite plugin
 * default is `14`).
 *
 * @formula  meanX = Σx / n ; meanY = Σy / n ; n = length ;
 *           num   = Σ((x − meanX)(y − meanY)) ;
 *           den   = sqrt(Σ(x − meanX)² · Σ(y − meanY)²) ;
 *           tsi   = clamp(num / den, −1, +1) ;
 *           NaN if the source window has zero variance, the index
 *           variance is zero (`length < 2`), or any window slot is
 *           non-finite.
 * @warmup   length − 1
 * @since 0.2
 * @stable
 *
 * `opts.offset` is a presentation display shift carried to the plot
 * emission as `xShift` (`+n` right / future, `−n` left / past); the
 * series value is unshifted.
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const t = ta.trendStrengthIndex("slot", bar.close, 20);
 *     // plot(t);
 */
export function trendStrengthIndex(
    slotId: string,
    source: ScalarOrSeries,
    length: number,
    opts?: TrendStrengthIndexOpts,
): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as TrendStrengthIndexSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(length, ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const src = readSourceValue(source);
    if (ctx.isTick) {
        slot.outBuffer.replaceHead(tickStep(slot, src));
    } else {
        slot.outBuffer.append(closeStep(slot, src));
    }
    return viewForOffset(slot, opts?.offset ?? 0);
}
