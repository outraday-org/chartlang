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
    /** EMA state after the latest closed bar with a finite source. */
    closedEma: number;
    /** EMA state before the current closed head; frozen across ticks. */
    priorClosedEma: number;
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
        alpha: Number.isInteger(length) && length > 0 ? 2 / (length + 1) : Number.NaN,
        length,
        closedEma: Number.NaN,
        priorClosedEma: Number.NaN,
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

function nextEma(src: number, prior: number, alpha: number): number {
    if (!Number.isFinite(src) || !Number.isFinite(alpha)) return Number.NaN;
    return Number.isFinite(prior) ? src * alpha + prior * (1 - alpha) : src;
}

function closeValue(slot: EmaSlot, src: number): number {
    // Advance the replace-head boundary on every close, including a NaN close.
    // A later tick always replays the current bar from this frozen state.
    slot.priorClosedEma = slot.closedEma;
    const next = nextEma(src, slot.closedEma, slot.alpha);
    if (Number.isFinite(next)) slot.closedEma = next;
    return next;
}

function tickValue(slot: EmaSlot, src: number): number {
    return nextEma(src, slot.priorClosedEma, slot.alpha);
}

/**
 * Exponential moving average. Recurrence `EMA[t] = α·x[t] + (1 − α)·EMA[t − 1]`
 * with `α = 2 / (length + 1)`. The first finite source value seeds the
 * recurrence immediately. A missing source bar emits `NaN` without changing
 * the last finite closed EMA. Tick-mode (`onBarTick`) recomputes the head from
 * the state before the current closed head so tentative values don't bleed
 * into the next close's recurrence. A non-positive or non-integer `length`
 * produces `NaN`.
 *
 * @formula  α = 2 / (length + 1) ;
 *           EMA[first finite t] = source[t] ;
 *           EMA[t] = source[t]·α + EMA[t−1]·(1−α)
 * @warmup   0 on a finite source; leading/missing source bars emit NaN
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
 *     // const head = e.current; // finite from the first finite source bar
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
    const src = readSourceValue(source);
    const value = ctx.isTick ? tickValue(slot, src) : closeValue(slot, src);
    if (ctx.isTick) slot.outBuffer.replaceHead(value);
    else slot.outBuffer.append(value);
    return viewForOffset(slot, opts?.offset ?? 0);
}
