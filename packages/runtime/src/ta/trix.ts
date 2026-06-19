// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/trix.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. TRIX composes three EMA sub-slots derived
// from the parent slot id (`${slotId}/ema1` / `/ema2` / `/ema3`) for
// the triple-smoothing chain plus a fourth `${slotId}/signal` EMA
// over the TRIX line. Mirrors the MACD sub-slot composition pattern.

import type { Series, TrixOpts, TrixResult } from "@invinite-org/chartlang-core";

import { ema } from "./ema.js";
import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView, makeShiftedSeriesView } from "../seriesView.js";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue.js";

const DEFAULT_SIGNAL = 9;

type TrixSlot = {
    readonly result: TrixResult;
    readonly trixBuffer: Float64RingBuffer;
    /** Closed `ema3` as of the prior closed bar — divisor for the
     * next close's TRIX. */
    prevClosedEma3: number;
    /** Closed `ema3` as of the bar BEFORE the prior closed bar —
     * used by tick replay (the current bar's "prior" is two closes
     * back from a tick on the in-progress bar). */
    prevPrevClosedEma3: number;
    /**
     * Per-offset frozen `TrixResult` cache. `offset === 0` returns
     * `result` by identity. Non-zero offsets get a frozen result
     * whose two Series are `makeShiftedSeriesView` proxies over the
     * same two underlying ring buffers.
     */
    readonly shiftedResults: Map<number, TrixResult>;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.trix called outside an active script step");
    }
    return ctx;
}

function initSlot(capacity: number, signalSeries: Series<number>): TrixSlot {
    const trixBuffer = new Float64RingBuffer(capacity);
    return {
        result: Object.freeze({
            trix: makeSeriesView<number>(trixBuffer),
            signal: signalSeries,
        }),
        trixBuffer,
        prevClosedEma3: Number.NaN,
        prevPrevClosedEma3: Number.NaN,
        shiftedResults: new Map(),
    };
}

function resultForOffset(slot: TrixSlot, offset: number, signalBuf: Float64RingBuffer): TrixResult {
    if (offset === 0) return slot.result;
    let cached = slot.shiftedResults.get(offset);
    if (cached === undefined) {
        cached = Object.freeze({
            trix: makeShiftedSeriesView<number>(slot.trixBuffer, offset),
            signal: makeShiftedSeriesView<number>(signalBuf, offset),
        });
        slot.shiftedResults.set(offset, cached);
    }
    return cached;
}

/**
 * TRIX — triple-smoothed EMA rate-of-change momentum oscillator
 * with an EMA-signal line. Composes three EMA sub-slots derived
 * from the parent slot id (`${slotId}/ema1` / `/ema2` / `/ema3`)
 * for the triple-smoothing chain, then computes
 * `100 · (ema3[t] − ema3[t−1]) / ema3[t−1]` per bar, and folds the
 * result into a fourth EMA sub-slot (`${slotId}/signal`) for the
 * signal line.
 *
 * @formula  ema1 = EMA(source, length) ;
 *           ema2 = EMA(ema1,   length) ;
 *           ema3 = EMA(ema2,   length) ;
 *           trix[t]   = ema3[t-1] === 0 ? NaN : 100 · (ema3[t] − ema3[t-1]) / ema3[t-1] ;
 *           signal[t] = EMA(trix, signalLength)
 * @warmup   3 · length + signalLength − 3 (first defined `signal` index ;
 *           trix line first defined at `3 · length − 2`)
 * @anchors  length, signalLength
 * @since 0.2
 * @stable
 *
 * `opts.offset` is a presentation display shift carried to the plot
 * emission as `xShift` for both outputs in lockstep (`+n` right / future,
 * `−n` left / past); the series values are unshifted, so
 * `series.current` on each output returns the value at the current bar.
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const t = ta.trix("slot", bar.close, 18);
 *     // plot(t.trix);
 *     // plot(t.signal);
 */
export function trix(
    slotId: string,
    source: ScalarOrSeries,
    length: number,
    opts?: TrixOpts,
): TrixResult {
    const ctx = getCtx();
    const signalLength = opts?.signalLength ?? DEFAULT_SIGNAL;
    const offset = opts?.offset ?? 0;
    const src = readSourceValue(source);

    // Triple-smoothing chain. Each outer EMA reads the prior EMA's
    // `.current` scalar.
    const e1 = ema(`${slotId}/ema1`, src, length).current;
    const e2 = ema(`${slotId}/ema2`, e1, length).current;
    const e3 = ema(`${slotId}/ema3`, e2, length).current;

    let slot = ctx.stream.taSlots.get(slotId) as TrixSlot | undefined;
    // The TRIX divisor on the current bar is the prior closed `ema3`.
    // On close-side we use `prevClosedEma3` (set at the previous close
    // — this is `ema3[t-1]` from the script-author's view). On ticks
    // we use `prevPrevClosedEma3` (set two closes back) because the
    // CURRENT bar's close has not yet happened — tick replay's "prev
    // closed ema3" is still two closes back.
    let prevE3: number;
    if (slot === undefined) prevE3 = Number.NaN;
    else if (ctx.isTick) prevE3 = slot.prevPrevClosedEma3;
    else prevE3 = slot.prevClosedEma3;
    const trixValue =
        Number.isFinite(e3) && Number.isFinite(prevE3) && prevE3 !== 0
            ? (100 * (e3 - prevE3)) / prevE3
            : Number.NaN;
    // Feed the TRIX value into the signal EMA. Always read the
    // un-shifted view; offset shifting for the composite result is
    // handled locally via `resultForOffset`.
    const signalSeries = ema(`${slotId}/signal`, trixValue, signalLength);
    if (slot === undefined) {
        slot = initSlot(ctx.stream.ohlcv.close.capacity, signalSeries);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const signalSubSlot = ctx.stream.taSlots.get(`${slotId}/signal`) as {
        outBuffer: Float64RingBuffer;
    };

    if (ctx.isTick) {
        slot.trixBuffer.replaceHead(trixValue);
        // Signal EMA's tick was handled by its own `ema()` call above.
    } else {
        slot.trixBuffer.append(trixValue);
        // Roll the prev-prev snapshot forward BEFORE overwriting
        // `prevClosedEma3` so tick replay on the next bar reads the
        // correct two-closes-back value.
        slot.prevPrevClosedEma3 = slot.prevClosedEma3;
        if (Number.isFinite(e3)) {
            slot.prevClosedEma3 = e3;
        }
    }
    return resultForOffset(slot, offset, signalSubSlot.outBuffer);
}
