// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/rvi.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. The up/down EMA arms compose `ta.ema` via
// sub-slots `${slotId}/upEma` / `${slotId}/downEma` so the EMA
// recurrence + warmup semantics flow in by reference.

import type { RviOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView, makeShiftedSeriesView } from "../seriesView.js";
import { ema } from "./ema.js";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue.js";

type RviSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly length: number;
    readonly sigmaWindow: Float64RingBuffer;
    sumX: number;
    sumX2: number;
    /** Last closed source value (basis of next bar's up/down classification). */
    prevSrc: number;
    /** Per-offset Series-view cache; see `sma.ts` for the convention. */
    readonly shiftedViews: Map<number, Series<number>>;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.rvi called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, capacity: number): RviSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        length,
        sigmaWindow: new Float64RingBuffer(length),
        sumX: 0,
        sumX2: 0,
        prevSrc: Number.NaN,
        shiftedViews: new Map(),
    };
}

function viewForOffset(slot: RviSlot, offset: number): Series<number> {
    if (offset === 0) return slot.series;
    let view = slot.shiftedViews.get(offset);
    if (view === undefined) {
        view = makeShiftedSeriesView<number>(slot.outBuffer, offset);
        slot.shiftedViews.set(offset, view);
    }
    return view;
}

function windowStdDev(n: number, sumX: number, sumX2: number): number {
    const mean = sumX / n;
    const variance = sumX2 / n - mean * mean;
    return Math.sqrt(Math.max(0, variance));
}

/** Fold a new source value into the sigma-window running sums. */
function appendToSigmaWindow(slot: RviSlot, src: number): number {
    if (slot.sigmaWindow.length < slot.sigmaWindow.capacity) {
        slot.sigmaWindow.append(src);
        if (Number.isFinite(src)) {
            slot.sumX += src;
            slot.sumX2 += src * src;
        } else {
            slot.sumX = Number.NaN;
            slot.sumX2 = Number.NaN;
        }
        if (slot.sigmaWindow.length < slot.sigmaWindow.capacity) return Number.NaN;
        if (!Number.isFinite(slot.sumX)) return Number.NaN;
        return windowStdDev(slot.sigmaWindow.length, slot.sumX, slot.sumX2);
    }
    const outgoing = slot.sigmaWindow.at(slot.sigmaWindow.length - 1);
    slot.sigmaWindow.append(src);
    if (!Number.isFinite(src)) {
        slot.sumX = Number.NaN;
        slot.sumX2 = Number.NaN;
        return Number.NaN;
    }
    if (!Number.isFinite(slot.sumX) || !Number.isFinite(outgoing)) {
        // A previous NaN poisoned the running sums; rebuild from the
        // live window (NaN values short-circuit the result to NaN).
        let sumX = 0;
        let sumX2 = 0;
        for (let i = 0; i < slot.sigmaWindow.length; i += 1) {
            const v = slot.sigmaWindow.at(i);
            if (!Number.isFinite(v)) {
                slot.sumX = Number.NaN;
                slot.sumX2 = Number.NaN;
                return Number.NaN;
            }
            sumX += v;
            sumX2 += v * v;
        }
        slot.sumX = sumX;
        slot.sumX2 = sumX2;
    } else {
        slot.sumX = slot.sumX - outgoing + src;
        slot.sumX2 = slot.sumX2 - outgoing * outgoing + src * src;
    }
    return windowStdDev(slot.sigmaWindow.length, slot.sumX, slot.sumX2);
}

/** Sigma at the tick boundary against the closed sigma-window state. */
function tickSigma(slot: RviSlot, src: number): number {
    if (slot.sigmaWindow.length < slot.sigmaWindow.capacity) return Number.NaN;
    if (!Number.isFinite(src)) return Number.NaN;
    const oldestInHead = slot.sigmaWindow.at(0);
    const sumX = slot.sumX - oldestInHead + src;
    const sumX2 = slot.sumX2 - oldestInHead * oldestInHead + src * src;
    return windowStdDev(slot.sigmaWindow.length, sumX, sumX2);
}

function classify(sigma: number, diff: number): { up: number; down: number } {
    if (!Number.isFinite(sigma) || !Number.isFinite(diff)) {
        return { up: Number.NaN, down: Number.NaN };
    }
    return {
        up: diff > 0 ? sigma : 0,
        down: diff < 0 ? sigma : 0,
    };
}

function rviValue(upEma: number, downEma: number): number {
    if (!Number.isFinite(upEma) || !Number.isFinite(downEma)) return Number.NaN;
    const total = upEma + downEma;
    if (total === 0) return Number.NaN;
    return (100 * upEma) / total;
}

/**
 * Relative Volatility Index — sub-pane oscillator bounded `[0, 100]`.
 * Like RSI but uses rolling stddev of the source instead of absolute
 * close changes for the magnitude, EMA-smoothed per TradingView's
 * `ta.rvi` reference. Composes `ta.ema` via two sub-slots
 * (`${slotId}/upEma`, `${slotId}/downEma`) — a fix to EMA's
 * recurrence flows in for free. NaN when either EMA arm is NaN or
 * when both arms are zero (zero-denominator).
 *
 * @formula  sigma[t]  = stddev(source[t − length + 1..= t]) ;
 *           upRaw[t]  = source[t] > source[t − 1] ? sigma[t] : 0 ;
 *           downRaw[t] = source[t] < source[t − 1] ? sigma[t] : 0 ;
 *           upEma     = EMA(length)(upRaw) ;
 *           downEma   = EMA(length)(downRaw) ;
 *           rvi[t]    = 100 · upEma[t] / (upEma[t] + downEma[t])
 * @warmup   2 · length − 1
 * @since 0.2
 * @stable
 *
 * `opts.offset` is a presentation display shift carried to the plot
 * emission as `xShift` (`+n` right / future, `−n` left / past); the
 * series value is unshifted.
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const r = ta.rvi(bar.close, 10);
 *     // plot(r);
 */
export function rvi(
    slotId: string,
    source: ScalarOrSeries,
    length: number,
    opts?: RviOpts,
): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as RviSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(length, ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const src = readSourceValue(source);
    if (ctx.isTick) {
        const sigma = tickSigma(slot, src);
        const diff = src - slot.prevSrc;
        const { up, down } = classify(sigma, diff);
        // Still drive the sub-slot EMAs so their tick-mode head stays
        // consistent with the closed state on a subsequent close.
        const upSeries = ema(`${slotId}/upEma`, up, slot.length);
        const downSeries = ema(`${slotId}/downEma`, down, slot.length);
        // NaN source short-circuits to NaN output regardless of how the
        // EMA arms forward-fill internally — RVI is undefined when the
        // current sample isn't measurable.
        const value = Number.isFinite(src)
            ? rviValue(upSeries.current, downSeries.current)
            : Number.NaN;
        slot.outBuffer.replaceHead(value);
    } else {
        const sigma = appendToSigmaWindow(slot, src);
        const diff = src - slot.prevSrc;
        const { up, down } = classify(sigma, diff);
        const upSeries = ema(`${slotId}/upEma`, up, slot.length);
        const downSeries = ema(`${slotId}/downEma`, down, slot.length);
        const value = Number.isFinite(src)
            ? rviValue(upSeries.current, downSeries.current)
            : Number.NaN;
        slot.outBuffer.append(value);
        slot.prevSrc = src;
    }
    return viewForOffset(slot, opts?.offset ?? 0);
}
