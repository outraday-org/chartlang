// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/rsi.ts
//   (commit d2d1043c1b039f66d2f3674526d303d31cf2f1e0, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape.

import type { RsiOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView } from "../seriesView";
import { wilderStep } from "./lib/wilderSmoothing";
import { type ScalarOrSeries, readSourceValue } from "./sourceValue";

type RsiSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly length: number;
    seedGainSum: number;
    seedLossSum: number;
    /** Number of diffs (= closed bars − 1) seen so far. */
    diffCount: number;
    avgGain: number;
    avgLoss: number;
    prevSrc: number;
    /** Source value as of the prior closed bar — used by tick-mode replay. */
    prevClosedSrc: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.rsi called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, capacity: number): RsiSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        length,
        seedGainSum: 0,
        seedLossSum: 0,
        diffCount: 0,
        avgGain: Number.NaN,
        avgLoss: Number.NaN,
        prevSrc: Number.NaN,
        prevClosedSrc: Number.NaN,
    };
}

function rsiFromAvgs(avgGain: number, avgLoss: number): number {
    if (avgLoss === 0) return 100;
    return 100 - 100 / (1 + avgGain / avgLoss);
}

function closeValue(slot: RsiSlot, src: number): number {
    if (!Number.isFinite(src)) {
        // Skip the diff; hold prior values forward.
        if (Number.isFinite(slot.avgGain) && Number.isFinite(slot.avgLoss)) {
            return rsiFromAvgs(slot.avgGain, slot.avgLoss);
        }
        return Number.NaN;
    }
    if (!Number.isFinite(slot.prevSrc)) {
        slot.prevSrc = src;
        slot.prevClosedSrc = src;
        return Number.NaN;
    }
    const diff = src - slot.prevSrc;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    slot.prevClosedSrc = slot.prevSrc;
    slot.prevSrc = src;
    slot.diffCount += 1;

    if (slot.diffCount < slot.length) {
        slot.seedGainSum += gain;
        slot.seedLossSum += loss;
        return Number.NaN;
    }
    if (slot.diffCount === slot.length) {
        slot.seedGainSum += gain;
        slot.seedLossSum += loss;
        slot.avgGain = slot.seedGainSum / slot.length;
        slot.avgLoss = slot.seedLossSum / slot.length;
        return rsiFromAvgs(slot.avgGain, slot.avgLoss);
    }
    slot.avgGain = wilderStep(slot.avgGain, gain, slot.length);
    slot.avgLoss = wilderStep(slot.avgLoss, loss, slot.length);
    return rsiFromAvgs(slot.avgGain, slot.avgLoss);
}

function tickValue(slot: RsiSlot, src: number): number {
    if (!Number.isFinite(src) || !Number.isFinite(slot.prevClosedSrc)) {
        if (Number.isFinite(slot.avgGain) && Number.isFinite(slot.avgLoss)) {
            return rsiFromAvgs(slot.avgGain, slot.avgLoss);
        }
        return Number.NaN;
    }
    // Replay the most recent diff using the (frozen) prior closed avgs.
    // We need pre-update avgs: at close we already overwrote `avgGain` /
    // `avgLoss`. So we reverse the Wilder step to recover them.
    if (slot.diffCount < slot.length) {
        // During seeding: simulate the seed completing with this tick.
        const diff = src - slot.prevClosedSrc;
        const gain = diff > 0 ? diff : 0;
        const loss = diff < 0 ? -diff : 0;
        const provisionalCount = slot.diffCount + 1;
        if (provisionalCount < slot.length) return Number.NaN;
        const provGain = (slot.seedGainSum + gain) / slot.length;
        const provLoss = (slot.seedLossSum + loss) / slot.length;
        return rsiFromAvgs(provGain, provLoss);
    }
    // Post-warmup: reverse the most recent Wilder step to get the prior-
    // close avgs, then apply this tick's diff against those.
    const diffClosed = slot.prevSrc - slot.prevClosedSrc;
    const closedGain = diffClosed > 0 ? diffClosed : 0;
    const closedLoss = diffClosed < 0 ? -diffClosed : 0;
    const priorAvgGain = (slot.avgGain * slot.length - closedGain) / (slot.length - 1);
    const priorAvgLoss = (slot.avgLoss * slot.length - closedLoss) / (slot.length - 1);
    const diff = src - slot.prevClosedSrc;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    const provGain = wilderStep(priorAvgGain, gain, slot.length);
    const provLoss = wilderStep(priorAvgLoss, loss, slot.length);
    return rsiFromAvgs(provGain, provLoss);
}

/**
 * Wilder's Relative Strength Index. Output range `[0, 100]`. First
 * `length` bars NaN (no diff for bar 0, then a seed window of
 * `length` diffs). Output is `100 − 100 / (1 + RS)` with
 * `RS = avgGain / avgLoss`; `avgLoss = 0` → RSI = 100.
 *
 * @formula  diff[t] = source[t] − source[t − 1] ;
 *           seed at bar `length` = simple mean of first `length` diffs ;
 *           avgGain[t] = (avgGain[t − 1] · (length − 1) + gain[t]) / length ;
 *           same for avgLoss ;
 *           RSI = 100 − 100 / (1 + avgGain / avgLoss)
 * @warmup   length
 * @since 0.1
 * @experimental
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const r = ta.rsi("slot", bar.close, 14);
 *     // const head = r.current;
 */
export function rsi(
    slotId: string,
    source: ScalarOrSeries,
    length: number,
    _opts?: RsiOpts,
): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as RsiSlot | undefined;
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
