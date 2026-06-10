// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/ulcer-index.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. Composes `ta.highest` via the sub-slot id
// `${slotId}/highest` so a fix to `highest` flows through.

import type { Series, UlcerIndexOpts } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView } from "../seriesView.js";
import { highest } from "./highest.js";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue.js";

type UlcerIndexSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly length: number;
    /** Sub-slot id passed to `ta.highest` for the rolling-max term. */
    readonly highestSub: string;
    /**
     * Closed-bar `drawdown_pct^2` values across the trailing `length`
     * bars (capacity `length`). `at(0)` is the head; older slots index
     * upward.
     */
    readonly drawdownSqWindow: Float64RingBuffer;
    sumDrawdownSq: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.ulcerIndex called outside an active script step");
    }
    return ctx;
}

function initSlot(slotId: string, length: number, capacity: number): UlcerIndexSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        length,
        highestSub: `${slotId}/highest`,
        drawdownSqWindow: new Float64RingBuffer(length),
        sumDrawdownSq: 0,
    };
}

function drawdownSquared(src: number, maxSrc: number): number {
    if (!Number.isFinite(src) || !Number.isFinite(maxSrc) || maxSrc === 0) {
        return Number.NaN;
    }
    const dd = (100 * (src - maxSrc)) / maxSrc;
    return dd * dd;
}

function closeValue(slot: UlcerIndexSlot, src: number, maxSrc: number): number {
    const ddSq = drawdownSquared(src, maxSrc);
    if (!Number.isFinite(ddSq)) {
        // Per task spec §6 (NaN handling): NaN source → NaN output.
        // Do NOT advance the window — preserves the previous closed
        // state for the next bar to consume.
        return Number.NaN;
    }
    if (slot.drawdownSqWindow.length === slot.length) {
        // Window full: evict the oldest before append.
        slot.sumDrawdownSq -= slot.drawdownSqWindow.at(slot.length - 1);
    }
    slot.drawdownSqWindow.append(ddSq);
    slot.sumDrawdownSq += ddSq;
    return Math.sqrt(slot.sumDrawdownSq / slot.drawdownSqWindow.length);
}

function tickValue(slot: UlcerIndexSlot, src: number, maxSrc: number): number {
    if (slot.drawdownSqWindow.length === 0) return Number.NaN;
    const ddSq = drawdownSquared(src, maxSrc);
    if (!Number.isFinite(ddSq)) return Number.NaN;
    // Substitute the tick's ddSq for the head slot's ddSq without
    // mutating the closed window. Hypothetical sum = sum − head + tick.
    const headSq = slot.drawdownSqWindow.at(0);
    const hypSum = slot.sumDrawdownSq - headSq + ddSq;
    return Math.sqrt(hypSum / slot.drawdownSqWindow.length);
}

/**
 * Ulcer Index — drawdown-based volatility. The trailing-window RMS of
 * `drawdown_pct[t] = 100 · (source[t] − highest(source, length)[t]) /
 * highest(source, length)[t]`. Composes `ta.highest` via the sub-slot
 * id `${slotId}/highest` so a fix to `highest` flows through. Always
 * non-negative.
 *
 * NaN sources (or zero rolling-max) emit NaN and do NOT advance the
 * window — the next bar's drawdown is computed against the still-valid
 * prior state.
 *
 * **Warmup ramp.** The first defined output lands at bar `length − 1`
 * (when `highest(source, length)` first emits). Up to bar `2·(length −
 * 1)` the window is partially populated and the RMS divides by the
 * actual `window.length`; from bar `2·(length − 1)` onward the window
 * is fully warm and the RMS uses the full `length` denominator. This
 * matches the task spec's `length − 1` warmup pin.
 *
 * @formula  highVal[t] = max(source[t − length + 1 .. t]) ;
 *           dd[t] = 100 · (source[t] − highVal[t]) / highVal[t] ;
 *           out[t] = sqrt(mean(dd^2 over the last `length` finite bars))
 * @warmup   length − 1
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const ui = ta.ulcerIndex(bar.close, 14);
 *     // plot(ui);
 */
export function ulcerIndex(
    slotId: string,
    source: ScalarOrSeries,
    length: number,
    _opts?: UlcerIndexOpts,
): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as UlcerIndexSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(slotId, length, ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const src = readSourceValue(source);
    // Compose: `highest` respects `ctx.isTick`. The sub-slot id is
    // stable per parent slot id.
    const maxSeries = highest(slot.highestSub, source, length);
    const maxSrc = maxSeries.current;
    if (ctx.isTick) {
        slot.outBuffer.replaceHead(tickValue(slot, src, maxSrc));
    } else {
        slot.outBuffer.append(closeValue(slot, src, maxSrc));
    }
    return slot.series;
}
