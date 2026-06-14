// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/vwma.ts
//   plus lib/vwma-of-float64.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape.

import type { Series, VwmaOpts } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView } from "../seriesView.js";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue.js";

type VwmaSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly length: number;
    /** Closed source values over the trailing `length` bars. */
    readonly sourceWindow: Float64RingBuffer;
    /** Parallel volume window over the trailing `length` bars. */
    readonly volumeWindow: Float64RingBuffer;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.vwma called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, capacity: number): VwmaSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        length,
        sourceWindow: new Float64RingBuffer(length),
        volumeWindow: new Float64RingBuffer(length),
    };
}

function weightedFromWindows(slot: VwmaSlot): number {
    let pvSum = 0;
    let volSum = 0;
    for (let j = 0; j < slot.length; j += 1) {
        const value = slot.sourceWindow.at(j);
        if (!Number.isFinite(value)) return Number.NaN;
        const rawVol = slot.volumeWindow.at(j);
        const v = Number.isFinite(rawVol) ? rawVol : 0;
        pvSum += value * v;
        volSum += v;
    }
    return volSum > 0 ? pvSum / volSum : Number.NaN;
}

function closeValue(slot: VwmaSlot, src: number, vol: number): number {
    slot.sourceWindow.append(src);
    slot.volumeWindow.append(vol);
    if (slot.sourceWindow.length < slot.length) return Number.NaN;
    return weightedFromWindows(slot);
}

function tickValue(slot: VwmaSlot, src: number, vol: number): number {
    if (slot.sourceWindow.length < slot.length) return Number.NaN;
    if (!Number.isFinite(src)) return Number.NaN;
    // Substitute (src, vol) at head position; walk the closed window
    // for positions 1..length-1.
    const headVol = Number.isFinite(vol) ? vol : 0;
    let pvSum = src * headVol;
    let volSum = headVol;
    for (let j = 1; j < slot.length; j += 1) {
        const value = slot.sourceWindow.at(j);
        if (!Number.isFinite(value)) return Number.NaN;
        const rawVol = slot.volumeWindow.at(j);
        const v = Number.isFinite(rawVol) ? rawVol : 0;
        pvSum += value * v;
        volSum += v;
    }
    return volSum > 0 ? pvSum / volSum : Number.NaN;
}

/**
 * Volume-weighted moving average — `Σ source[t−j] · volume[t−j]` over
 * the trailing `length` bars divided by `Σ volume[t−j]`. NaN volume
 * slots are treated as `0` (matches `vwmaFloat64`'s null-coalesce
 * semantics). A NaN source anywhere inside the window emits `NaN`;
 * a window whose total volume is `0` emits `NaN` (the ratio is
 * undefined). Reads bar volume from `RuntimeContext.stream.bar.volume`.
 *
 * @formula  out[t] = (Σ_{j=0..length-1} source[t − j] · volume[t − j])
 *                  / (Σ_{j=0..length-1} volume[t − j])
 *                 ;  NaN when the denominator is 0.
 * @warmup   length − 1
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const v = ta.vwma(bar.close, 20);
 *     // plot(v);
 */
export function vwma(
    slotId: string,
    source: ScalarOrSeries,
    length: number,
    _opts?: VwmaOpts,
): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as VwmaSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(length, ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const src = readSourceValue(source);
    const vol = ctx.stream.bar.volume;
    if (ctx.isTick) {
        slot.outBuffer.replaceHead(tickValue(slot, src, vol));
    } else {
        slot.outBuffer.append(closeValue(slot, src, vol));
    }
    return slot.series;
}
