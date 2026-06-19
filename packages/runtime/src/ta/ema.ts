// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/ema.ts
//   plus lib/ema-of-float64.ts
//   (commit d2d1043c1b039f66d2f3674526d303d31cf2f1e0, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape.

import type { EmaOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView, makeShiftedSeriesView } from "../seriesView.js";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue.js";

type EmaSlot = {
    readonly kind: "ta.ema";
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly alpha: number;
    readonly length: number;
    seedSum: number;
    seedCount: number;
    prevEma: number;
    prevClosedEma: number;
    /** Per-offset Series-view cache; see `sma.ts` for the convention. */
    readonly shiftedViews: Map<number, Series<number>>;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.ema called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, capacity: number): EmaSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        kind: "ta.ema",
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        alpha: 2 / (length + 1),
        length,
        seedSum: 0,
        seedCount: 0,
        prevEma: Number.NaN,
        prevClosedEma: Number.NaN,
        shiftedViews: new Map(),
    };
}

function viewForOffset(slot: EmaSlot, offset: number): Series<number> {
    if (offset === 0) return slot.series;
    let view = slot.shiftedViews.get(offset);
    if (view === undefined) {
        view = makeShiftedSeriesView<number>(slot.outBuffer, offset);
        slot.shiftedViews.set(offset, view);
    }
    return view;
}

function compute(slot: EmaSlot, src: number, isTick: boolean): number {
    if (!Number.isFinite(src)) {
        return isTick ? slot.prevEma : slot.prevClosedEma;
    }
    if (slot.seedCount < slot.length) {
        if (isTick) {
            const nextSum = slot.seedSum + src;
            const nextCount = slot.seedCount + 1;
            if (nextCount < slot.length) return Number.NaN;
            return nextSum / slot.length;
        }
        slot.seedSum += src;
        slot.seedCount += 1;
        if (slot.seedCount < slot.length) {
            slot.prevClosedEma = Number.NaN;
            return Number.NaN;
        }
        const seedValue = slot.seedSum / slot.length;
        slot.prevClosedEma = seedValue;
        slot.prevEma = seedValue;
        return seedValue;
    }
    const prev = slot.prevClosedEma;
    const next = src * slot.alpha + prev * (1 - slot.alpha);
    if (!isTick) {
        slot.prevClosedEma = next;
        slot.prevEma = next;
    }
    return next;
}

/**
 * Exponential moving average. Recurrence `EMA[t] = α·x[t] + (1 − α)·EMA[t − 1]`
 * with `α = 2 / (length + 1)` after a seed of `simple mean of the first
 * `length` finite source values`. Tick-mode (`onBarTick`) recomputes the
 * head from the previous closed EMA so partial-bar values don't bleed
 * into the next close's recurrence.
 *
 * @formula  α = 2 / (length + 1) ;
 *           seed at bar length−1 = mean(source[0..length−1]) ;
 *           EMA[t] = source[t]·α + EMA[t−1]·(1−α)
 * @warmup   length − 1
 * @since 0.1
 * @stable
 *
 * `opts.offset` is a presentation display shift carried to the plot
 * emission as `xShift` (`+n` right / future, `−n` left / past); the
 * series value is unshifted.
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const e = ta.ema("slot-id", bar.close, 20);
 *     // const head = e.current; // NaN until bar length-1
 *     // const projected = ta.ema("slot2", bar.close, 20, { offset: 5 });
 */
export function ema(
    slotId: string,
    source: ScalarOrSeries,
    length: number,
    opts?: EmaOpts,
): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as EmaSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(length, ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const value = compute(slot, readSourceValue(source), ctx.isTick);
    if (ctx.isTick) slot.outBuffer.replaceHead(value);
    else slot.outBuffer.append(value);
    return viewForOffset(slot, opts?.offset ?? 0);
}
