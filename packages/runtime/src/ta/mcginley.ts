// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/mcginley.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape.

import type { McginleyOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView } from "../seriesView";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue";

type McginleySlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly length: number;
    /** Tick-side recurrence anchor (current bar, may be intra-bar). */
    prevMc: number;
    /** Close-side recurrence anchor (prior closed bar). */
    prevClosedMc: number;
    /** Number of finite source values folded into the slot so far. */
    seedCount: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.mcginley called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, capacity: number): McginleySlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        length,
        prevMc: Number.NaN,
        prevClosedMc: Number.NaN,
        seedCount: 0,
    };
}

/**
 * Apply the McGinley Dynamic recurrence step given the prior MC
 * anchor. `prev === 0` is the well-defined zero-seed edge case:
 * `(src/0)^4 = +Infinity` → division by `+Infinity` → 0 → sticky-zero
 * fix-point. The task spec calls for NaN in that regime — concretely,
 * a `prev === 0` recurrence cannot escape the fix-point, so we emit
 * NaN to signal the degenerate state.
 */
function step(src: number, prev: number, length: number): number {
    if (prev === 0) return Number.NaN;
    const ratio = src / prev;
    const denom = length * ratio * ratio * ratio * ratio;
    return prev + (src - prev) / denom;
}

function compute(slot: McginleySlot, src: number, isTick: boolean): number {
    if (!Number.isFinite(src)) {
        // Mid-stream NaN forward-fills the prior value (matches the
        // EMA / SMMA recurrence convention).
        return isTick ? slot.prevMc : slot.prevClosedMc;
    }
    // Warmup: emit NaN until `length` finite source values have been
    // seen (matches invinite's seed convention). At the warmup
    // boundary the recurrence is seeded with the source value itself.
    if (slot.seedCount < slot.length - 1) {
        if (isTick) return Number.NaN;
        slot.seedCount += 1;
        slot.prevClosedMc = Number.NaN;
        slot.prevMc = Number.NaN;
        return Number.NaN;
    }
    if (!Number.isFinite(slot.prevClosedMc)) {
        // Seed bar — `length`-th finite source value lands here.
        if (isTick) return src;
        slot.seedCount += 1;
        slot.prevClosedMc = src;
        slot.prevMc = src;
        return src;
    }
    const prev = slot.prevClosedMc;
    const next = step(src, prev, slot.length);
    if (!isTick) {
        slot.prevClosedMc = next;
        slot.prevMc = next;
    }
    return next;
}

/**
 * McGinley Dynamic — an adaptive moving average with an automatic
 * lag-compensation correction. The recurrence
 * `mc[t] = mc[t-1] + (src[t] − mc[t-1]) / (length · (src[t] / mc[t-1])⁴)`
 * scales the step size by the relative change between source and the
 * prior MA value, so the indicator tracks faster on strong moves and
 * smoother on quiet bars. NaN source forward-fills the prior value;
 * `prev === 0` is the well-defined zero-seed fix-point and emits NaN
 * (the recurrence cannot escape a zero anchor — matches the invinite
 * reference's NaN-correct degenerate handling).
 *
 * @formula  seed at length-th finite source bar : mc = src ;
 *           mc[t] = mc[t-1] + (src[t] − mc[t-1]) / (length · (src[t] / mc[t-1])^4)
 * @warmup   length
 * @since 0.2
 * @experimental
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const m = ta.mcginley(bar.close, 14);
 *     // plot(m);
 */
export function mcginley(
    slotId: string,
    source: ScalarOrSeries,
    length: number,
    _opts?: McginleyOpts,
): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as McginleySlot | undefined;
    if (slot === undefined) {
        slot = initSlot(length, ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const value = compute(slot, readSourceValue(source), ctx.isTick);
    if (ctx.isTick) slot.outBuffer.replaceHead(value);
    else slot.outBuffer.append(value);
    return slot.series;
}
