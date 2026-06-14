// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/wma.ts
//   plus lib/wma-of-float64.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape.

import type { Series, WmaOpts } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView } from "../seriesView.js";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue.js";

type WmaSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly length: number;
    readonly denom: number;
    /**
     * Closed source values across the trailing `length` bars. `at(0)` is
     * the most recent close (the head bar); `at(length - 1)` is the
     * oldest value still in the window.
     */
    readonly window: Float64RingBuffer;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.wma called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, capacity: number): WmaSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        length,
        denom: (length * (length + 1)) / 2,
        window: new Float64RingBuffer(length),
    };
}

function weightedFromWindow(slot: WmaSlot): number {
    // `window.at(0)` is the head; weight on the head is `length`, weight
    // on the oldest bar (`at(length - 1)`) is `1`. Any NaN slot in the
    // window short-circuits the result to NaN (matches `wmaFloat64`'s
    // window short-circuit semantics).
    let sum = 0;
    for (let j = 0; j < slot.length; j += 1) {
        const v = slot.window.at(j);
        if (!Number.isFinite(v)) return Number.NaN;
        sum += v * (slot.length - j);
    }
    return sum / slot.denom;
}

function closeValue(slot: WmaSlot, src: number): number {
    slot.window.append(src);
    if (slot.window.length < slot.length) return Number.NaN;
    return weightedFromWindow(slot);
}

function tickValue(slot: WmaSlot, src: number): number {
    // The window holds the closed-bar history. A tick replaces the head
    // bar's value with `src`; compute the weighted sum against the
    // closed window with `src` substituted at position 0.
    if (slot.window.length < slot.length) return Number.NaN;
    if (!Number.isFinite(src)) return Number.NaN;
    let sum = src * slot.length;
    for (let j = 1; j < slot.length; j += 1) {
        const v = slot.window.at(j);
        if (!Number.isFinite(v)) return Number.NaN;
        sum += v * (slot.length - j);
    }
    return sum / slot.denom;
}

/**
 * Weighted moving average — linear weights `1..N` over the trailing
 * `length` source values, denominator `N(N + 1) / 2`. Warmup of
 * `length − 1` bars returns `NaN`; a NaN anywhere inside the window
 * also returns `NaN` (full-recompute weighted windows cannot
 * meaningfully forward-fill a gap). Tick-mode replays the head as
 * `(N·tickValue + Σ_{j=1..N-1} window[j]·(N−j)) / denom` so a
 * partial-bar tick doesn't pollute the next close's weighted sum.
 *
 * @formula  denom = length(length + 1) / 2 ;
 *           out[t] = (Σ_{j=0..length-1} source[t − j] · (length − j)) / denom
 * @warmup   length − 1
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const w = ta.wma(bar.close, 14);
 *     // plot(w);
 */
export function wma(
    slotId: string,
    source: ScalarOrSeries,
    length: number,
    _opts?: WmaOpts,
): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as WmaSlot | undefined;
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
