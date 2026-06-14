// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/coppock.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape.
//
// DEVIATION from the task spec's "composes `ta.change`" hint:
// `ta.change` emits ABSOLUTE deltas, while Coppock's ROC is a
// PERCENTAGE rate-of-change (`100 · (src − src[n]) / src[n]`). We
// compute the percentage ROCs inline against our own sourceWindow
// rather than composing `ta.change`. The WMA math mirrors
// `lib/wmaFloat64` (linear weights `(N, N − 1, …, 1)`, denominator
// `N(N + 1) / 2`); we inline the WMA over a per-close `sumWindow`
// rather than allocating a `Float64Array` per close to feed
// `wmaFloat64`.

import type { CoppockOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView } from "../seriesView.js";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue.js";

const DEFAULT_ROC1_LENGTH = 11;
const DEFAULT_ROC2_LENGTH = 14;
const DEFAULT_WMA_LENGTH = 10;

type CoppockSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly roc1Length: number;
    readonly roc2Length: number;
    readonly wmaLength: number;
    /** Last `max(roc1, roc2) + 1` closed source values. `at(0)` is the head. */
    readonly sourceWindow: Float64RingBuffer;
    /** Last `wmaLength` ROC1+ROC2 sums (`at(0)` is the head). */
    readonly sumWindow: Float64RingBuffer;
    /** Number of closed bars folded into the slot so far. */
    barCount: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.coppock called outside an active script step");
    }
    return ctx;
}

function initSlot(
    roc1Length: number,
    roc2Length: number,
    wmaLength: number,
    capacity: number,
): CoppockSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    const lookbackCapacity = Math.max(roc1Length, roc2Length) + 1;
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        roc1Length,
        roc2Length,
        wmaLength,
        sourceWindow: new Float64RingBuffer(lookbackCapacity),
        sumWindow: new Float64RingBuffer(wmaLength),
        barCount: 0,
    };
}

/**
 * Percentage rate-of-change against a lookback value. Returns NaN on
 * a NaN / zero divisor (matching invinite's `prev === 0` guard).
 */
function pctRoc(current: number, lookback: number): number {
    if (!Number.isFinite(lookback) || lookback === 0 || !Number.isFinite(current)) {
        return Number.NaN;
    }
    return (100 * (current - lookback)) / lookback;
}

/**
 * Inline linear-weighted moving average over the `sumWindow` ring.
 * `at(0)` is the most recent value (weight `wmaLength`); `at(wmaLength − 1)`
 * is the oldest (weight `1`). Returns NaN if the window is not full
 * or any slot is non-finite.
 */
function wmaOverSumWindow(slot: CoppockSlot): number {
    if (slot.sumWindow.length < slot.wmaLength) return Number.NaN;
    const denom = (slot.wmaLength * (slot.wmaLength + 1)) / 2;
    let acc = 0;
    for (let i = 0; i < slot.wmaLength; i += 1) {
        const v = slot.sumWindow.at(i);
        if (!Number.isFinite(v)) return Number.NaN;
        acc += v * (slot.wmaLength - i);
    }
    return acc / denom;
}

function computeRocSum(slot: CoppockSlot, src: number): number {
    // sourceWindow.at(roc1Length) is the bar `roc1Length` ago RELATIVE
    // TO the just-appended head (`at(0)` is `src`). Same for roc2.
    if (slot.sourceWindow.length <= slot.roc1Length) return Number.NaN;
    if (slot.sourceWindow.length <= slot.roc2Length) return Number.NaN;
    const lookback1 = slot.sourceWindow.at(slot.roc1Length);
    const lookback2 = slot.sourceWindow.at(slot.roc2Length);
    const roc1 = pctRoc(src, lookback1);
    const roc2 = pctRoc(src, lookback2);
    if (!Number.isFinite(roc1) || !Number.isFinite(roc2)) return Number.NaN;
    return roc1 + roc2;
}

function closeValue(slot: CoppockSlot, src: number): number {
    slot.sourceWindow.append(src);
    slot.barCount += 1;
    const sum = computeRocSum(slot, src);
    slot.sumWindow.append(sum);
    return wmaOverSumWindow(slot);
}

function tickValue(slot: CoppockSlot, src: number): number {
    if (slot.sourceWindow.length === 0) return Number.NaN;
    // Substitute the head of `sourceWindow` with the tick `src`. The
    // lookback bars (`at(roc1Length)` / `at(roc2Length)`) are
    // pre-close and unaffected by the tick.
    slot.sourceWindow.replaceHead(src);
    const sum = computeRocSum(slot, src);
    slot.sumWindow.replaceHead(sum);
    return wmaOverSumWindow(slot);
}

/**
 * Coppock Curve — long-term momentum indicator (Edwin Coppock, 1962).
 * `WMA(ROC(source, roc1Length) + ROC(source, roc2Length), wmaLength)`
 * where ROC is the percentage rate-of-change. Defaults `(11, 14, 10)`
 * matches Coppock's original monthly-equities formulation. Unbounded;
 * zero crossings are the canonical signal (positive → bullish).
 *
 * @formula  roc1 = 100 · (source[t] − source[t − roc1Length]) / source[t − roc1Length] ;
 *           roc2 = 100 · (source[t] − source[t − roc2Length]) / source[t − roc2Length] ;
 *           sum  = roc1 + roc2 ;
 *           coppock = (Σ sum[t − N + 1 + i] · (i + 1)) / (N(N + 1) / 2)
 *                     for i in 0..N − 1, N = wmaLength
 * @warmup   max(roc1Length, roc2Length) + wmaLength − 1
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const c = ta.coppock("slot", bar.close);
 *     // plot(c);
 */
export function coppock(
    slotId: string,
    source: ScalarOrSeries,
    opts?: CoppockOpts,
): Series<number> {
    const ctx = getCtx();
    const roc1Length = opts?.roc1Length ?? DEFAULT_ROC1_LENGTH;
    const roc2Length = opts?.roc2Length ?? DEFAULT_ROC2_LENGTH;
    const wmaLength = opts?.wmaLength ?? DEFAULT_WMA_LENGTH;
    let slot = ctx.stream.taSlots.get(slotId) as CoppockSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(roc1Length, roc2Length, wmaLength, ctx.stream.ohlcv.close.capacity);
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
