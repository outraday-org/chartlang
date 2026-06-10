// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/smma.ts
//   plus lib/smma-of-float64.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape.

import type { Series, SmmaOpts } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView } from "../seriesView.js";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue.js";

type SmmaSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly alpha: number;
    readonly length: number;
    seedSum: number;
    seedCount: number;
    prevSmma: number;
    prevClosedSmma: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.smma called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, capacity: number): SmmaSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        alpha: 1 / length,
        length,
        seedSum: 0,
        seedCount: 0,
        prevSmma: Number.NaN,
        prevClosedSmma: Number.NaN,
    };
}

function compute(slot: SmmaSlot, src: number, isTick: boolean): number {
    if (!Number.isFinite(src)) {
        // Mid-stream NaN forward-fills the prior value (matches
        // `smmaFloat64`'s recurrence-MA convention).
        return isTick ? slot.prevSmma : slot.prevClosedSmma;
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
            slot.prevClosedSmma = Number.NaN;
            return Number.NaN;
        }
        const seedValue = slot.seedSum / slot.length;
        slot.prevClosedSmma = seedValue;
        slot.prevSmma = seedValue;
        return seedValue;
    }
    const prev = slot.prevClosedSmma;
    const next = src * slot.alpha + prev * (1 - slot.alpha);
    if (!isTick) {
        slot.prevClosedSmma = next;
        slot.prevSmma = next;
    }
    return next;
}

/**
 * Smoothed moving average (Wilder's RMA). Recurrence
 * `SMMA[t] = α·x[t] + (1 − α)·SMMA[t − 1]` with `α = 1 / length`
 * after a seed of the simple mean of the first `length` finite
 * source values. Mid-stream NaN forward-fills the prior value
 * (matches the recurrence-MA convention shared with `ta.ema`).
 * Tick-mode (`onBarTick`) recomputes the head from the previous
 * closed SMMA so partial-bar values don't bleed into the next
 * close's recurrence.
 *
 * @formula  α = 1 / length ;
 *           seed at bar length−1 = mean(source[0..length−1]) ;
 *           SMMA[t] = source[t]·α + SMMA[t−1]·(1−α)
 * @warmup   length − 1
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const s = ta.smma(bar.close, 14);
 *     // plot(s);
 */
export function smma(
    slotId: string,
    source: ScalarOrSeries,
    length: number,
    _opts?: SmmaOpts,
): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as SmmaSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(length, ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const value = compute(slot, readSourceValue(source), ctx.isTick);
    if (ctx.isTick) slot.outBuffer.replaceHead(value);
    else slot.outBuffer.append(value);
    return slot.series;
}
