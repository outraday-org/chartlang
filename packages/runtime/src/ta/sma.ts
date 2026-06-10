// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/sma.ts
//   plus lib/sma-of-float64.ts
//   (commit d2d1043c1b039f66d2f3674526d303d31cf2f1e0, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape.

import type { Series, SmaOpts } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView, makeShiftedSeriesView } from "../seriesView";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue";

type SmaSlot = {
    readonly kind: "ta.sma";
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly length: number;
    /**
     * Window of the **closed** source values across the last `length` bars.
     * Holds bars `[t-length+1 .. t]` for the latest closed bar t. Ticks
     * compute a hypothetical "head replaced" mean from `windowSum -
     * window.at(0) + tickValue`; closes pop the oldest and push the new.
     */
    readonly window: Float64RingBuffer;
    sum: number;
    /**
     * Lazy cache of offset-shifted Series views keyed by `opts.offset`.
     * `offset === 0` callers bypass this map and return `series`
     * directly — identity-preserving. Populated on first call per
     * non-zero offset; identity is stable per offset thereafter.
     */
    readonly shiftedViews: Map<number, Series<number>>;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.sma called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, capacity: number): SmaSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        kind: "ta.sma",
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        length,
        window: new Float64RingBuffer(length),
        sum: 0,
        shiftedViews: new Map(),
    };
}

function viewForOffset(slot: SmaSlot, offset: number): Series<number> {
    if (offset === 0) return slot.series;
    let view = slot.shiftedViews.get(offset);
    if (view === undefined) {
        view = makeShiftedSeriesView<number>(slot.outBuffer, offset);
        slot.shiftedViews.set(offset, view);
    }
    return view;
}

function tickValue(slot: SmaSlot, src: number): number {
    // `window` currently holds the close-side values `[t-length+1 .. t]` for
    // the most-recent closed bar. The tick replaces bar `t`'s value with
    // `src`, so the hypothetical mean is `(sum - window.at(0)) + src`.
    if (!Number.isFinite(src)) return Number.NaN;
    if (slot.window.length < slot.length) return Number.NaN;
    const oldestInHead = slot.window.at(0);
    return (slot.sum - oldestInHead + src) / slot.length;
}

function closeValue(slot: SmaSlot, src: number): number {
    if (!Number.isFinite(src)) {
        // Skip the window update; emit the prior closed mean (or NaN when
        // unwarmed). The window's contents are unchanged so future closes
        // continue against the last valid set.
        if (slot.window.length < slot.length) return Number.NaN;
        return slot.sum / slot.length;
    }
    if (slot.window.length < slot.length) {
        slot.window.append(src);
        slot.sum += src;
        if (slot.window.length < slot.length) return Number.NaN;
        return slot.sum / slot.length;
    }
    const outgoing = slot.window.at(slot.length - 1);
    slot.window.append(src);
    slot.sum = slot.sum + src - outgoing;
    return slot.sum / slot.length;
}

/**
 * Simple moving average — rolling mean of the last `length` source
 * values. Warmup of `length − 1` bars returns `NaN`. Tick-mode replays
 * the head as `(window_sum − window_head + tick_value) / length` so a
 * partial-bar tick doesn't pollute the next close's running sum.
 * `opts.offset` shifts the returned series so `series.current` reads
 * the value `offset` bars ago (PLAN.md §9.1).
 *
 * @formula  out[t] = (source[t] + source[t − 1] + … + source[t − length + 1]) / length
 * @warmup   length − 1
 * @since 0.1
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const s = ta.sma("slot", bar.close, 20);
 *     // const head = s.current; // NaN until bar length-1
 *     // const lagged = ta.sma("slot2", bar.close, 20, { offset: 5 });
 */
export function sma(
    slotId: string,
    source: ScalarOrSeries,
    length: number,
    opts?: SmaOpts,
): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as SmaSlot | undefined;
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
    return viewForOffset(slot, opts?.offset ?? 0);
}
