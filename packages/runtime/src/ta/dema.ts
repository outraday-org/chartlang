// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/dema.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. DEMA composes two EMA sub-slots derived from
// the parent slot id.

import type { DemaOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView } from "../seriesView.js";
import { ema } from "./ema.js";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue.js";

type DemaSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly length: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.dema called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, capacity: number): DemaSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        length,
    };
}

/**
 * Double Exponential Moving Average — `DEMA = 2·EMA(src) − EMA(EMA(src))`.
 * Composes two EMA sub-slots derived from the parent slot id
 * (`${slotId}/ema1`, `${slotId}/ema2`). The outer EMA reads the inner
 * EMA's `.current` scalar each bar; the parent slot allocates its own
 * `outBuffer + series` because the output is a linear combination of
 * the two sub-slots (not equal to either). Mirrors the MACD / HMA
 * sub-slot pattern.
 *
 * @formula  ema1 = EMA(source, length) ;
 *           ema2 = EMA(ema1, length) ;
 *           out  = 2 · ema1 − ema2
 * @warmup   2 · length − 2
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const d = ta.dema(bar.close, 20);
 *     // plot(d);
 */
export function dema(
    slotId: string,
    source: ScalarOrSeries,
    length: number,
    _opts?: DemaOpts,
): Series<number> {
    const ctx = getCtx();
    const src = readSourceValue(source);
    const ema1Series = ema(`${slotId}/ema1`, src, length);
    const e1 = ema1Series.current;
    const ema2Series = ema(`${slotId}/ema2`, e1, length);
    const e2 = ema2Series.current;
    const value = Number.isFinite(e1) && Number.isFinite(e2) ? 2 * e1 - e2 : Number.NaN;

    let slot = ctx.stream.taSlots.get(slotId) as DemaSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(length, ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    if (ctx.isTick) slot.outBuffer.replaceHead(value);
    else slot.outBuffer.append(value);
    return slot.series;
}
