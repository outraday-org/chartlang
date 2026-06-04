// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/macd.ts
//   (folded onto lib/ema-of-float64.ts per PLAN.md §9.4)
//   (commit d2d1043c1b039f66d2f3674526d303d31cf2f1e0, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. The MACD primitive composes three EMA
// sub-slots and a virtual "MACD line" Float64 buffer the signal EMA
// reads from.

import type { MacdOpts, MacdResult, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView } from "../seriesView";
import { ema } from "./ema";
import { type ScalarOrSeries, readSourceValue } from "./sourceValue";

const DEFAULT_FAST = 12;
const DEFAULT_SLOW = 26;
const DEFAULT_SIGNAL = 9;

type MacdSlot = {
    readonly result: MacdResult;
    readonly macdBuf: Float64RingBuffer;
    readonly histBuf: Float64RingBuffer;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.macd called outside an active script step");
    }
    return ctx;
}

function initSlot(capacity: number, signalSeries: Series<number>): MacdSlot {
    const macdBuf = new Float64RingBuffer(capacity);
    const histBuf = new Float64RingBuffer(capacity);
    return {
        result: Object.freeze({
            macd: makeSeriesView<number>(macdBuf),
            signal: signalSeries,
            hist: makeSeriesView<number>(histBuf),
        }),
        macdBuf,
        histBuf,
    };
}

/**
 * MACD — fast EMA minus slow EMA, with a signal-line EMA over the
 * MACD line and a histogram of their difference. Defaults
 * `{ fastLength: 12, slowLength: 26, signalLength: 9 }`. Composes
 * three EMA primitives at sub-slots `${slotId}/fast`, `${slotId}/slow`,
 * `${slotId}/signal`. The signal EMA reads from an internal MACD
 * Float64 ring; the user-facing `macd` Series wraps the same buffer.
 *
 * @formula  fast   = ema(source, fastLength) ;
 *           slow   = ema(source, slowLength) ;
 *           macd   = fast − slow ;
 *           signal = ema(macd, signalLength) ;
 *           hist   = macd − signal
 * @warmup   slowLength + signalLength − 1 (slow EMA seeds at slowLength − 1; signal EMA seeds signalLength − 1 bars after that)
 * @since 0.1
 * @experimental
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const m = ta.macd("slot", bar.close);
 *     // const h = m.hist.current;
 */
export function macd(slotId: string, source: ScalarOrSeries, opts?: MacdOpts): MacdResult {
    const ctx = getCtx();
    const fastLength = opts?.fastLength ?? DEFAULT_FAST;
    const slowLength = opts?.slowLength ?? DEFAULT_SLOW;
    const signalLength = opts?.signalLength ?? DEFAULT_SIGNAL;
    const src = readSourceValue(source);
    const fastSeries = ema(`${slotId}/fast`, src, fastLength);
    const slowSeries = ema(`${slotId}/slow`, src, slowLength);
    const fa = fastSeries.current;
    const sa = slowSeries.current;
    const macdValue = Number.isFinite(fa) && Number.isFinite(sa) ? fa - sa : Number.NaN;
    // Feed macdValue into the signal EMA via a scalar source.
    const signalSeries = ema(`${slotId}/signal`, macdValue, signalLength);

    let slot = ctx.stream.taSlots.get(slotId) as MacdSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(ctx.stream.ohlcv.close.capacity, signalSeries);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const sig = signalSeries.current;
    const histValue =
        Number.isFinite(macdValue) && Number.isFinite(sig) ? macdValue - sig : Number.NaN;
    if (ctx.isTick) {
        slot.macdBuf.replaceHead(macdValue);
        slot.histBuf.replaceHead(histValue);
    } else {
        slot.macdBuf.append(macdValue);
        slot.histBuf.append(histValue);
    }
    return slot.result;
}
