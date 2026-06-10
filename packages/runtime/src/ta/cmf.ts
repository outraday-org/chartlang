// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/cmf.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. The rolling-window sum follows the
// `ulcerIndex` "subtract head + add tick" pattern for tick-mode replay
// (no window mutation on tick).

import type { CmfOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView } from "../seriesView.js";

type CmfSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly length: number;
    /**
     * Closed-bar money-flow volume values across the trailing
     * `length` bars (capacity `length`). `at(0)` is the head bar's
     * MFV; older slots index upward.
     */
    readonly mfvWindow: Float64RingBuffer;
    /** Closed-bar volume values across the same window. */
    readonly volWindow: Float64RingBuffer;
    sumMfv: number;
    sumVol: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.cmf called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, capacity: number): CmfSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        length,
        mfvWindow: new Float64RingBuffer(length),
        volWindow: new Float64RingBuffer(length),
        sumMfv: 0,
        sumVol: 0,
    };
}

/**
 * Per-bar money-flow volume — CLV × volume with the same zero-range
 * + NaN guards as `adl.ts` (defensive 0 contribution on either edge
 * case).
 */
function mfvAt(close: number, high: number, low: number, volume: number): number {
    if (
        !Number.isFinite(close) ||
        !Number.isFinite(high) ||
        !Number.isFinite(low) ||
        !Number.isFinite(volume)
    ) {
        return 0;
    }
    const range = high - low;
    // Defensive: flat bar (high === low) — emit zero CLV contribution
    // rather than divide-by-zero. Real OHLC streams rarely hit this.
    /* c8 ignore next */
    if (range === 0) return 0;
    const clv = (close - low - (high - close)) / range;
    return clv * volume;
}

/** Safe-volume contribution to the rolling-window volume sum. */
function safeVol(volume: number): number {
    return Number.isFinite(volume) ? volume : 0;
}

function emit(sumMfv: number, sumVol: number, ready: boolean): number {
    if (!ready || sumVol === 0) return Number.NaN;
    return sumMfv / sumVol;
}

/**
 * Chaikin Money Flow — trailing-window sum of money-flow volume
 * divided by trailing-window sum of volume. Bounded between -1 and
 * +1 mathematically. Zero-range bars (`high === low`) contribute 0
 * to the numerator (matches invinite's CLV guard); NaN OHLC / volume
 * bars contribute 0 to both numerator and denominator.
 *
 * **Tick mode.** Substitutes the tick's per-bar (mfv, volume)
 * contribution for the head slot's stored values without mutating the
 * trailing-window rings — mirrors the `ulcerIndex.ts` substitution
 * shape ("hypSum = sum − head + tick").
 *
 * @formula  cmf[t] = Σ_{u ∈ window(t)} mfv[u] / Σ_{u ∈ window(t)} volume[u]
 *           where mfv = ((C − L) − (H − C)) / (H − L) · volume
 * @warmup   length − 1
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta, plot } from "@invinite-org/chartlang-core";
 *     // const c = ta.cmf(20);
 *     // plot(c);
 */
export function cmf(slotId: string, length: number, _opts?: CmfOpts): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as CmfSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(length, ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const { close, high, low, volume } = ctx.stream.bar;
    const mfv = mfvAt(close, high, low, volume);
    const vol = safeVol(volume);

    if (ctx.isTick) {
        // Tick replay against the closed window: substitute the head
        // slot's contribution with the tick's, leaving the window
        // untouched. Pre-warmup ticks emit NaN.
        if (slot.mfvWindow.length < slot.length) {
            slot.outBuffer.replaceHead(Number.NaN);
            return slot.series;
        }
        const headMfv = slot.mfvWindow.at(0);
        const headVol = slot.volWindow.at(0);
        const hypMfv = slot.sumMfv - headMfv + mfv;
        const hypVol = slot.sumVol - headVol + vol;
        slot.outBuffer.replaceHead(emit(hypMfv, hypVol, true));
        return slot.series;
    }

    // Close-side: evict the oldest slot if the ring is full, then
    // append the new (mfv, vol) pair and refresh the running sums.
    if (slot.mfvWindow.length === slot.length) {
        slot.sumMfv -= slot.mfvWindow.at(slot.length - 1);
        slot.sumVol -= slot.volWindow.at(slot.length - 1);
    }
    slot.mfvWindow.append(mfv);
    slot.volWindow.append(vol);
    slot.sumMfv += mfv;
    slot.sumVol += vol;
    slot.outBuffer.append(emit(slot.sumMfv, slot.sumVol, slot.mfvWindow.length === slot.length));
    return slot.series;
}
