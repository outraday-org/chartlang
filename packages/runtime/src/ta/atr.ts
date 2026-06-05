// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/atr.ts
//   plus lib/tr-series.ts
//   (commit d2d1043c1b039f66d2f3674526d303d31cf2f1e0, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. ATR derives from `bar.high`/`bar.low`/
// `bar.close` directly — no `source` argument per Pine.

import type { AtrOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView, makeShiftedSeriesView } from "../seriesView";
import { wilderStep } from "./lib/wilderSmoothing";

type AtrSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly length: number;
    seedTrSum: number;
    /** Number of TR values folded into the seed so far. */
    trCount: number;
    atr: number;
    /** Close of the prior closed bar — used to compute TR on the next close. */
    prevClose: number;
    /** Close of the bar before the current bar (i.e. the close 2 bars ago). */
    prevPrevClose: number;
    /** ATR as of the prior closed bar — used by tick-mode replay. */
    prevClosedAtr: number;
    /** Per-offset Series-view cache; see `sma.ts` for the convention. */
    readonly shiftedViews: Map<number, Series<number>>;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.atr called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, capacity: number): AtrSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        length,
        seedTrSum: 0,
        trCount: 0,
        atr: Number.NaN,
        prevClose: Number.NaN,
        prevPrevClose: Number.NaN,
        prevClosedAtr: Number.NaN,
        shiftedViews: new Map(),
    };
}

function viewForOffset(slot: AtrSlot, offset: number): Series<number> {
    if (offset === 0) return slot.series;
    let view = slot.shiftedViews.get(offset);
    if (view === undefined) {
        view = makeShiftedSeriesView<number>(slot.outBuffer, offset);
        slot.shiftedViews.set(offset, view);
    }
    return view;
}

function trueRange(high: number, low: number, prevClose: number): number {
    if (!Number.isFinite(prevClose)) return high - low;
    return Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
}

function closeValue(slot: AtrSlot, high: number, low: number, close: number): number {
    if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
        if (Number.isFinite(slot.atr)) return slot.atr;
        return Number.NaN;
    }
    const tr = trueRange(high, low, slot.prevClose);
    slot.prevPrevClose = slot.prevClose;
    slot.prevClose = close;
    slot.trCount += 1;

    if (slot.trCount < slot.length) {
        slot.seedTrSum += tr;
        return Number.NaN;
    }
    if (slot.trCount === slot.length) {
        slot.seedTrSum += tr;
        slot.atr = slot.seedTrSum / slot.length;
        slot.prevClosedAtr = slot.atr;
        return slot.atr;
    }
    slot.prevClosedAtr = slot.atr;
    slot.atr = wilderStep(slot.atr, tr, slot.length);
    return slot.atr;
}

function tickValue(slot: AtrSlot, high: number, low: number, close: number): number {
    if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
        return Number.isFinite(slot.atr) ? slot.atr : Number.NaN;
    }
    if (slot.trCount < slot.length) return Number.NaN;
    // Tick TR uses the **bar before the current bar**'s close — frozen
    // by the prior close-side advance as `prevPrevClose`.
    const tr = trueRange(high, low, slot.prevPrevClose);
    if (slot.trCount === slot.length) {
        // We just seeded on the current close; tick replays the same seed
        // (the seed window is fixed once the bar closes).
        return slot.atr;
    }
    return wilderStep(slot.prevClosedAtr, tr, slot.length);
}

/**
 * Wilder's Average True Range. Sources from `bar.high` / `bar.low` /
 * `bar.close` directly (no `source` arg — matches Pine). Seeds at bar
 * `length − 1` as the simple mean of the first `length` TR values;
 * subsequent slots use the Wilder recurrence with α = 1/length.
 *
 * @formula  TR[t] = max(high − low, |high − prevClose|, |low − prevClose|) ;
 *           seed at bar length − 1 = mean(TR[0 .. length − 1]) ;
 *           ATR[t] = (ATR[t − 1] · (length − 1) + TR[t]) / length
 * @warmup   length − 1
 * @since 0.1
 * @experimental
 *
 * `opts.offset` shifts the returned series so `series.current` reads
 * the value `offset` bars ago (PLAN.md §9.1).
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const a = ta.atr("slot", 14);
 *     // const head = a.current;
 *     // const lagged = ta.atr("slot2", 14, { offset: 5 });
 */
export function atr(slotId: string, length: number, opts?: AtrOpts): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as AtrSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(length, ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const bar = ctx.stream.bar;
    if (ctx.isTick) {
        slot.outBuffer.replaceHead(tickValue(slot, bar.high, bar.low, bar.close));
    } else {
        slot.outBuffer.append(closeValue(slot, bar.high, bar.low, bar.close));
    }
    return viewForOffset(slot, opts?.offset ?? 0);
}
