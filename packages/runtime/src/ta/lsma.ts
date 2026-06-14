// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/lsma.ts
//   plus lib/linear-regression.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. The per-bar walk is the streaming-compatible
// shape of `lib/linearRegression`'s closed-form formula; that helper is
// reused verbatim as the reference computation in the property tests.

import type { LsmaOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView } from "../seriesView.js";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue.js";

type LsmaSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly length: number;
    /** Precomputed `(length − 1) / 2`. */
    readonly xMean: number;
    /** Precomputed `Σ (j − xMean)²` for `j = 0..length − 1`. */
    readonly sumXX: number;
    /**
     * Trailing `length` source values. `at(0)` is the head (most
     * recent close); `at(length − 1)` is the oldest.
     */
    readonly sourceWindow: Float64RingBuffer;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.lsma called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, capacity: number): LsmaSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    const xMean = (length - 1) / 2;
    let sumXX = 0;
    for (let j = 0; j < length; j += 1) {
        const dev = j - xMean;
        sumXX += dev * dev;
    }
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        length,
        xMean,
        sumXX,
        sourceWindow: new Float64RingBuffer(length),
    };
}

function lsmaFromWindow(slot: LsmaSlot, headOverride?: number): number {
    // Single-pass scan: build sumY, then a second pass for the
    // covariance numerator. Two passes still fit the streaming budget
    // (O(length) per bar) and the structure mirrors the reference
    // `linearRegression` helper byte-for-byte at the math level.
    let sumY = 0;
    for (let j = 0; j < slot.length; j += 1) {
        // j = 0 → oldest (window.at(length - 1)); j = length - 1 → head.
        const ageFromHead = slot.length - 1 - j;
        const v =
            ageFromHead === 0 && headOverride !== undefined
                ? headOverride
                : slot.sourceWindow.at(ageFromHead);
        if (!Number.isFinite(v)) return Number.NaN;
        sumY += v;
    }
    const yMean = sumY / slot.length;
    let num = 0;
    for (let j = 0; j < slot.length; j += 1) {
        const ageFromHead = slot.length - 1 - j;
        const v =
            ageFromHead === 0 && headOverride !== undefined
                ? headOverride
                : slot.sourceWindow.at(ageFromHead);
        num += (j - slot.xMean) * (v - yMean);
    }
    const slope = num / slot.sumXX;
    const intercept = yMean - slope * slot.xMean;
    return intercept + slope * (slot.length - 1);
}

function closeValue(slot: LsmaSlot, src: number): number {
    slot.sourceWindow.append(src);
    if (slot.sourceWindow.length < slot.length) return Number.NaN;
    return lsmaFromWindow(slot);
}

function tickValue(slot: LsmaSlot, src: number): number {
    if (slot.sourceWindow.length < slot.length) return Number.NaN;
    if (!Number.isFinite(src)) return Number.NaN;
    return lsmaFromWindow(slot, src);
}

/**
 * Least Squares Moving Average — the value of the ordinary-least-
 * squares regression line `y = a + b·x` evaluated at the last bar of
 * the trailing `length`-bar window (with `x = 0..length − 1` and `y`
 * the source values). Mathematically equivalent to
 * `linearRegression(source, length).value` from `lib/linearRegression`
 * — that helper is reused verbatim as the property-test reference.
 * Per-bar cost is a two-pass O(length) window walk (sumY, then
 * covariance numerator) to keep the per-bar allocation profile flat;
 * a NaN anywhere inside the window short-circuits the output to NaN
 * (matches the WMA / weighted-window convention).
 *
 * @formula  xMean = (length − 1) / 2 ;
 *           sumXX = Σ (j − xMean)²  for j = 0..length − 1 ;
 *           yMean = (1 / length) · Σ source[t − length + 1 + j] ;
 *           slope = (Σ (j − xMean) · (source[t − length + 1 + j] − yMean)) / sumXX ;
 *           intercept = yMean − slope · xMean ;
 *           out[t] = intercept + slope · (length − 1)
 * @warmup   length − 1
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const l = ta.lsma(bar.close, 25);
 *     // plot(l);
 */
export function lsma(
    slotId: string,
    source: ScalarOrSeries,
    length: number,
    _opts?: LsmaOpts,
): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as LsmaSlot | undefined;
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
