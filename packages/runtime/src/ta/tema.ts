// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/tema.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. TEMA composes three EMA sub-slots derived
// from the parent slot id.

import type { Series, TemaOpts } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView } from "../seriesView";
import { ema } from "./ema";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue";

type TemaSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly length: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.tema called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, capacity: number): TemaSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        length,
    };
}

/**
 * Triple Exponential Moving Average —
 * `TEMA = 3·EMA(src) − 3·EMA(EMA(src)) + EMA(EMA(EMA(src)))`. Composes
 * three EMA sub-slots derived from the parent slot id
 * (`${slotId}/ema1`, `${slotId}/ema2`, `${slotId}/ema3`). Each outer
 * EMA reads the inner EMA's `.current` scalar each bar; the parent
 * slot allocates its own `outBuffer + series` because the output is a
 * linear combination of the three sub-slots. Mirrors the DEMA / MACD
 * sub-slot pattern.
 *
 * @formula  ema1 = EMA(source, length) ;
 *           ema2 = EMA(ema1, length) ;
 *           ema3 = EMA(ema2, length) ;
 *           out  = 3 · ema1 − 3 · ema2 + ema3
 * @warmup   3 · length − 3
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const t = ta.tema(bar.close, 20);
 *     // plot(t);
 */
export function tema(
    slotId: string,
    source: ScalarOrSeries,
    length: number,
    _opts?: TemaOpts,
): Series<number> {
    const ctx = getCtx();
    const src = readSourceValue(source);
    const e1 = ema(`${slotId}/ema1`, src, length).current;
    const e2 = ema(`${slotId}/ema2`, e1, length).current;
    const e3 = ema(`${slotId}/ema3`, e2, length).current;
    const value =
        Number.isFinite(e1) && Number.isFinite(e2) && Number.isFinite(e3)
            ? 3 * e1 - 3 * e2 + e3
            : Number.NaN;

    let slot = ctx.stream.taSlots.get(slotId) as TemaSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(length, ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    if (ctx.isTick) slot.outBuffer.replaceHead(value);
    else slot.outBuffer.append(value);
    return slot.series;
}
