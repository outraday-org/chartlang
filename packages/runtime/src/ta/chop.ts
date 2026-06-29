// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/chop.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. Chop composes `ta.highest` / `ta.lowest`
// via sub-slots `${slotId}/highest` / `${slotId}/lowest` over
// `bar.high` / `bar.low` for the range denominator; the TR-sum
// numerator is maintained as a sliding-window sum inside the slot
// (same internal TR formula as `ta.atr`, but raw — Pine `ta.chop`
// uses raw TR sums rather than the Wilder-smoothed ATR).

import type { ChopOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView } from "../seriesView.js";
import { highest } from "./highest.js";
import { lowest } from "./lowest.js";

type ChopSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly length: number;
    readonly logN: number;
    /** Sliding window of TR values (capacity `length`). */
    readonly trWindow: Float64RingBuffer;
    sumTr: number;
    /** Close of the prior closed bar (TR uses `prev.close`). */
    prevClose: number;
    /** Close of the bar before the current bar (used by tick-mode TR). */
    prevPrevClose: number;
    /** TR sum as of the prior closed bar — used by tick-mode replay. */
    prevClosedSumTr: number;
    /** TR value the head close folded in — needed to roll it back on tick. */
    prevClosedHeadTr: number;
    /** TR value evicted by the head close — needed to restore on tick. */
    prevClosedEvictedTr: number;
    /** Number of closed bars folded into the slot. */
    barCount: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.chop called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, capacity: number): ChopSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        length,
        logN: Math.log10(length),
        trWindow: new Float64RingBuffer(length),
        sumTr: 0,
        prevClose: Number.NaN,
        prevPrevClose: Number.NaN,
        prevClosedSumTr: 0,
        prevClosedHeadTr: Number.NaN,
        prevClosedEvictedTr: Number.NaN,
        barCount: 0,
    };
}

function trueRange(high: number, low: number, prevClose: number): number {
    if (!Number.isFinite(prevClose)) return high - low;
    return Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
}

function chopValue(slot: ChopSlot, upper: number, lower: number): number {
    if (slot.barCount < slot.length) return Number.NaN;
    // Defensive: upper / lower come from highest / lowest sub-slots over
    // bar.high / bar.low, both finite once the highest / lowest slots
    // are warmed. Same goes for sumTr (kept positive once trSeries seeds).
    /* c8 ignore next */
    if (!Number.isFinite(upper) || !Number.isFinite(lower)) return Number.NaN;
    const range = upper - lower;
    /* c8 ignore next */
    if (range <= 0) return Number.NaN;
    /* c8 ignore next */
    if (!Number.isFinite(slot.sumTr) || slot.sumTr <= 0) return Number.NaN;
    const raw = (100 * Math.log10(slot.sumTr / range)) / slot.logN;
    // Clamp to [0, 100]. The raw value can exceed 100 on bars with
    // large gaps (where TR > range) — Pine + TradingView present chop
    // as a bounded oscillator, so we clamp at the output to match.
    /* c8 ignore next 2 */
    if (raw < 0) return 0;
    if (raw > 100) return 100;
    return raw;
}

function closeValue(
    slot: ChopSlot,
    high: number,
    low: number,
    close: number,
    upper: number,
    lower: number,
): number {
    if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
        // Skip the bar (don't advance TR window state); emit NaN.
        return Number.NaN;
    }
    const tr = trueRange(high, low, slot.prevClose);
    // Capture pre-append state for tick-mode rollback.
    slot.prevClosedSumTr = slot.sumTr;
    const evicted =
        slot.trWindow.length === slot.length ? slot.trWindow.at(slot.length - 1) : Number.NaN;
    slot.prevClosedEvictedTr = evicted;
    if (Number.isFinite(evicted)) slot.sumTr -= evicted;
    slot.trWindow.append(tr);
    slot.sumTr += tr;
    slot.prevClosedHeadTr = tr;
    slot.prevPrevClose = slot.prevClose;
    slot.prevClose = close;
    slot.barCount += 1;
    return chopValue(slot, upper, lower);
}

function tickValue(
    slot: ChopSlot,
    high: number,
    low: number,
    close: number,
    upper: number,
    lower: number,
): number {
    if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
        return Number.NaN;
    }
    // Defensive: tickValue runs after at least one close, so barCount is ≥ 1.
    /* c8 ignore next */
    if (slot.barCount === 0) return Number.NaN;
    // Recompute the head TR using the BAR-BEFORE-CURRENT's close
    // (mirrors atr.ts:103-117 — the close-side advance moved
    // `prevPrevClose` into the slot before we replaced `prevClose`).
    const tr = trueRange(high, low, slot.prevPrevClose);
    // Synthesise the post-rollback sum and re-fold the tick's TR.
    let synthSum = slot.prevClosedSumTr;
    if (Number.isFinite(slot.prevClosedEvictedTr)) synthSum -= slot.prevClosedEvictedTr;
    synthSum += tr;
    // Temporarily flip the slot's sumTr so chopValue sees the synth.
    const savedSum = slot.sumTr;
    slot.sumTr = synthSum;
    const value = chopValue(slot, upper, lower);
    slot.sumTr = savedSum;
    return value;
}

/**
 * Choppiness Index — sub-pane volatility regime indicator. High
 * values (`> 61.8`) signal a sideways / choppy market; low values
 * (`< 38.2`) signal a strong trend. Output range `[0, 100]`. Reads
 * `bar.high` / `bar.low` / `bar.close` directly (no source param,
 * mirrors Pine). Composes the registered `ta.highest` / `ta.lowest`
 * primitives via sub-slots `${slotId}/highest` and `${slotId}/lowest`
 * for the range denominator; the TR-sum numerator is a sliding-window
 * sum inside the slot (same internal TR math as `ta.atr` but raw —
 * Pine `ta.chop` does NOT use the Wilder-smoothed ATR). NaN until
 * the trailing `length`-bar window is fully warmed AND the range is
 * positive.
 *
 * @formula  TR[t]  = max(high − low, |high − prevClose|, |low − prevClose|) ;
 *           range  = highest(high, length) − lowest(low, length) ;
 *           sumTr  = Σ TR over trailing length bars ;
 *           chop   = 100 · log10(sumTr / range) / log10(length)
 * @warmup   length
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const c = ta.chop(14);
 *     // plot(c);
 */
export function chop(slotId: string, length: number, _opts?: ChopOpts): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as ChopSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(length, ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const bar = ctx.stream.bar;
    // `bar.{high,low}` go to `highest`/`lowest` AS proxies (they need the
    // indexable Series source); coerce scalar copies for `closeValue`/
    // `tickValue`, whose `Number.isFinite` guards need real numbers.
    const upperSeries = highest(`${slotId}/highest`, bar.high, length);
    const lowerSeries = lowest(`${slotId}/lowest`, bar.low, length);
    const upper = upperSeries.current;
    const lower = lowerSeries.current;
    const high = +bar.high;
    const low = +bar.low;
    const close = +bar.close;
    if (ctx.isTick) {
        slot.outBuffer.replaceHead(tickValue(slot, high, low, close, upper, lower));
    } else {
        slot.outBuffer.append(closeValue(slot, high, low, close, upper, lower));
    }
    return slot.series;
}
