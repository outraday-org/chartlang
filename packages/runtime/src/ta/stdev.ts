// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/lib/rolling-stddev.ts
//   (commit d2d1043c1b039f66d2f3674526d303d31cf2f1e0, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape.

import type { Series, StdevOpts } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView, makeShiftedSeriesView } from "../seriesView.js";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue.js";

type StdevSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly length: number;
    readonly biased: boolean;
    readonly window: Float64RingBuffer;
    sumX: number;
    sumX2: number;
    /** Per-offset Series-view cache; see `sma.ts` for the convention. */
    readonly shiftedViews: Map<number, Series<number>>;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.stdev called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, capacity: number, biased: boolean): StdevSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        length,
        biased,
        window: new Float64RingBuffer(length),
        sumX: 0,
        sumX2: 0,
        shiftedViews: new Map(),
    };
}

function viewForOffset(slot: StdevSlot, offset: number): Series<number> {
    if (offset === 0) return slot.series;
    let view = slot.shiftedViews.get(offset);
    if (view === undefined) {
        view = makeShiftedSeriesView<number>(slot.outBuffer, offset);
        slot.shiftedViews.set(offset, view);
    }
    return view;
}

function denominator(slot: StdevSlot): number {
    return slot.biased ? slot.length : slot.length - 1;
}

function stddevFromSums(sumX: number, sumX2: number, slot: StdevSlot): number {
    const denom = denominator(slot);
    if (denom <= 0) return Number.NaN;
    const mean = sumX / slot.length;
    const variance = (sumX2 - slot.length * mean * mean) / denom;
    // Numerical: clamp tiny negatives from accumulated rounding error.
    return Math.sqrt(Math.max(0, variance));
}

function closeValue(slot: StdevSlot, src: number): number {
    if (!Number.isFinite(src)) {
        if (slot.window.length < slot.length) return Number.NaN;
        return stddevFromSums(slot.sumX, slot.sumX2, slot);
    }
    if (slot.window.length < slot.length) {
        slot.window.append(src);
        slot.sumX += src;
        slot.sumX2 += src * src;
        if (slot.window.length < slot.length) return Number.NaN;
        return stddevFromSums(slot.sumX, slot.sumX2, slot);
    }
    const outgoing = slot.window.at(slot.length - 1);
    slot.window.append(src);
    slot.sumX = slot.sumX + src - outgoing;
    slot.sumX2 = slot.sumX2 + src * src - outgoing * outgoing;
    return stddevFromSums(slot.sumX, slot.sumX2, slot);
}

function tickValue(slot: StdevSlot, src: number): number {
    if (!Number.isFinite(src)) return Number.NaN;
    if (slot.window.length < slot.length) return Number.NaN;
    const oldestInHead = slot.window.at(0);
    const sumX = slot.sumX - oldestInHead + src;
    const sumX2 = slot.sumX2 - oldestInHead * oldestInHead + src * src;
    return stddevFromSums(sumX, sumX2, slot);
}

/**
 * Rolling sample / population standard deviation over the last
 * `length` source values. Defaults to **biased = false** (sample
 * stddev, denominator `length − 1`) to match core's `StdevOpts`.
 * `biased = true` switches to population (denominator `length`).
 *
 * @formula  μ = mean(window) ;
 *           σ = sqrt(Σ(x − μ)² / N), N = length (biased) or length − 1 (sample)
 * @warmup   length − 1
 * @since 0.1
 * @stable
 *
 * `opts.offset` shifts the returned series so `series.current` reads
 * the value `offset` bars ago (PLAN.md §9.1).
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const s = ta.stdev("slot", bar.close, 20, { biased: false });
 *     // const head = s.current;
 *     // const lagged = ta.stdev("slot2", bar.close, 20, { offset: 5 });
 */
export function stdev(
    slotId: string,
    source: ScalarOrSeries,
    length: number,
    opts?: StdevOpts,
): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as StdevSlot | undefined;
    if (slot === undefined) {
        const biased = opts?.biased === true;
        slot = initSlot(length, ctx.stream.ohlcv.close.capacity, biased);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const src = readSourceValue(source);
    if (ctx.isTick) {
        slot.outBuffer.replaceHead(tickValue(slot, src));
    } else {
        slot.outBuffer.append(closeValue(slot, src));
    }
    return viewForOffset(slot, opts?.offset ?? 0);
}
