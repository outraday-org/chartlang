// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/cmo.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.

import type { CmoOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView } from "../seriesView";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue";

type CmoSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly length: number;
    readonly gainWindow: Float64RingBuffer;
    readonly lossWindow: Float64RingBuffer;
    sumGain: number;
    sumLoss: number;
    prevSrc: number;
    /** Source as of the bar before the most recent close — used by tick replay. */
    prevClosedSrc: number;
    /** Most-recent close-side emit (the head bar's CMO). NaN if unwarmed. */
    cmo: number;
    /** Gain pushed onto the window during the most recent close. */
    closedHeadGain: number;
    /** Loss pushed onto the window during the most recent close. */
    closedHeadLoss: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.cmo called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, capacity: number): CmoSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        length,
        gainWindow: new Float64RingBuffer(length),
        lossWindow: new Float64RingBuffer(length),
        sumGain: 0,
        sumLoss: 0,
        prevSrc: Number.NaN,
        prevClosedSrc: Number.NaN,
        cmo: Number.NaN,
        closedHeadGain: 0,
        closedHeadLoss: 0,
    };
}

function cmoFromSums(sumGain: number, sumLoss: number): number {
    const denom = sumGain + sumLoss;
    if (denom === 0) return Number.NaN;
    const raw = (100 * (sumGain - sumLoss)) / denom;
    return Math.min(100, Math.max(-100, raw));
}

function closeValue(slot: CmoSlot, src: number): number {
    if (!Number.isFinite(src)) {
        // Hold prior values forward; window is unchanged.
        slot.closedHeadGain = 0;
        slot.closedHeadLoss = 0;
        return slot.cmo;
    }
    if (!Number.isFinite(slot.prevSrc)) {
        slot.prevSrc = src;
        slot.prevClosedSrc = src;
        slot.closedHeadGain = 0;
        slot.closedHeadLoss = 0;
        return Number.NaN;
    }
    const diff = src - slot.prevSrc;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    slot.prevClosedSrc = slot.prevSrc;
    slot.prevSrc = src;
    slot.closedHeadGain = gain;
    slot.closedHeadLoss = loss;
    if (slot.gainWindow.length === slot.length) {
        const oldestGain = slot.gainWindow.at(slot.length - 1);
        const oldestLoss = slot.lossWindow.at(slot.length - 1);
        slot.sumGain -= oldestGain;
        slot.sumLoss -= oldestLoss;
    }
    slot.gainWindow.append(gain);
    slot.lossWindow.append(loss);
    slot.sumGain += gain;
    slot.sumLoss += loss;
    if (slot.gainWindow.length < slot.length) {
        slot.cmo = Number.NaN;
        return Number.NaN;
    }
    slot.cmo = cmoFromSums(slot.sumGain, slot.sumLoss);
    return slot.cmo;
}

function tickValue(slot: CmoSlot, src: number): number {
    if (!Number.isFinite(src) || !Number.isFinite(slot.prevClosedSrc)) {
        return slot.cmo;
    }
    if (slot.gainWindow.length < slot.length) return Number.NaN;
    // Swap the most recently pushed gain/loss for the tick's gain/loss.
    const diff = src - slot.prevClosedSrc;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    const provGain = slot.sumGain - slot.closedHeadGain + gain;
    const provLoss = slot.sumLoss - slot.closedHeadLoss + loss;
    return cmoFromSums(provGain, provLoss);
}

/**
 * Chande Momentum Oscillator — `100 · (Σ gain − Σ loss) / (Σ gain + Σ loss)`
 * over the trailing `length` window of per-bar diffs. Bounded `[-100, 100]`.
 * Flat-line input (zero denominator) → NaN. First emit lands at bar
 * `length` (after `length` diffs have been folded; warmup = `length`).
 *
 * @formula  diff[t] = source[t] − source[t − 1] ;
 *           gain[t] = max(diff[t], 0) ;
 *           loss[t] = max(−diff[t], 0) ;
 *           CMO[t]  = 100 · (Σ gain − Σ loss) / (Σ gain + Σ loss)
 * @warmup   length
 * @since 0.2
 * @experimental
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const c = ta.cmo("slot", bar.close, 9);
 *     // const head = c.current;
 */
export function cmo(
    slotId: string,
    source: ScalarOrSeries,
    length: number,
    _opts?: CmoOpts,
): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as CmoSlot | undefined;
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
