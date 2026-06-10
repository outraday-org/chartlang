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

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView, makeShiftedSeriesView } from "../seriesView.js";
import { ema } from "./ema.js";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue.js";

const DEFAULT_FAST = 12;
const DEFAULT_SLOW = 26;
const DEFAULT_SIGNAL = 9;

type MacdSlot = {
    readonly result: MacdResult;
    readonly macdBuf: Float64RingBuffer;
    readonly histBuf: Float64RingBuffer;
    /**
     * Reference to the signal-EMA sub-slot's output ring buffer.
     * Captured at first call so per-offset shifted signal views can be
     * constructed without re-entering `ema()` (which would double-
     * advance the sub-slot's compute on every bar).
     */
    readonly signalBuf: Float64RingBuffer;
    /**
     * Per-offset frozen `MacdResult` cache. `offset === 0` returns
     * `result` directly (identity-preserving). Each cached result
     * proxies the same three underlying outputs via shifted views.
     */
    readonly shiftedResults: Map<number, MacdResult>;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.macd called outside an active script step");
    }
    return ctx;
}

function initSlot(
    capacity: number,
    signalSeries: Series<number>,
    signalBuf: Float64RingBuffer,
): MacdSlot {
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
        signalBuf,
        shiftedResults: new Map(),
    };
}

function resultForOffset(slot: MacdSlot, offset: number): MacdResult {
    if (offset === 0) return slot.result;
    let cached = slot.shiftedResults.get(offset);
    if (cached === undefined) {
        cached = Object.freeze({
            macd: makeShiftedSeriesView<number>(slot.macdBuf, offset),
            signal: makeShiftedSeriesView<number>(slot.signalBuf, offset),
            hist: makeShiftedSeriesView<number>(slot.histBuf, offset),
        });
        slot.shiftedResults.set(offset, cached);
    }
    return cached;
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
 * @stable
 *
 * `opts.offset` shifts all three outputs in lockstep (PLAN.md §9.1) —
 * `series.current` on each output returns the value `offset` bars ago.
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const m = ta.macd("slot", bar.close);
 *     // const h = m.hist.current;
 *     // const lagged = ta.macd("slot2", bar.close, { offset: 5 });
 */
export function macd(slotId: string, source: ScalarOrSeries, opts?: MacdOpts): MacdResult {
    const ctx = getCtx();
    const fastLength = opts?.fastLength ?? DEFAULT_FAST;
    const slowLength = opts?.slowLength ?? DEFAULT_SLOW;
    const signalLength = opts?.signalLength ?? DEFAULT_SIGNAL;
    const offset = opts?.offset ?? 0;
    const signalSlotId = `${slotId}/signal`;
    const src = readSourceValue(source);
    const fastSeries = ema(`${slotId}/fast`, src, fastLength);
    const slowSeries = ema(`${slotId}/slow`, src, slowLength);
    const fa = fastSeries.current;
    const sa = slowSeries.current;
    const macdValue = Number.isFinite(fa) && Number.isFinite(sa) ? fa - sa : Number.NaN;
    // Feed macdValue into the signal EMA. Always call with the
    // un-shifted (default) view — offset shifting for the composite
    // MacdResult happens via the local `resultForOffset`, which reads
    // directly off the signal-EMA's outBuffer (captured below).
    const signalSeries = ema(signalSlotId, macdValue, signalLength);

    let slot = ctx.stream.taSlots.get(slotId) as MacdSlot | undefined;
    if (slot === undefined) {
        // Capture the signal-EMA sub-slot's output ring buffer so
        // future shifted-view lookups don't need to re-enter `ema()`.
        const emaSlot = ctx.stream.taSlots.get(signalSlotId) as { outBuffer: Float64RingBuffer };
        slot = initSlot(ctx.stream.ohlcv.close.capacity, signalSeries, emaSlot.outBuffer);
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
    return resultForOffset(slot, offset);
}
