// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/rvgi.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. Composition: two `ta.sma` sub-slots
// (`${slotId}/numSma`, `${slotId}/denSma`) for the numerator /
// denominator smoothing. The per-bar 4-bar `(1, 2, 2, 1) / 6`
// weighted sum + the 4-bar signal weighted sum are bespoke (no
// registry helper exposes that exact weighted window).

import type { RvgiOpts, RvgiResult, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView } from "../seriesView";
import { sma } from "./sma";

const DEFAULT_LENGTH = 10;

type RvgiSlot = {
    result: RvgiResult | null;
    readonly rvgiBuf: Float64RingBuffer;
    readonly signalBuf: Float64RingBuffer;
    readonly rvgiSeries: Series<number>;
    readonly signalSeries: Series<number>;
    readonly length: number;
    /** Last 4 bars' `(close − open)` deltas; `at(0)` is the head. */
    readonly coWindow: Float64RingBuffer;
    /** Last 4 bars' `(high − low)` ranges; `at(0)` is the head. */
    readonly hlWindow: Float64RingBuffer;
    /** Last 4 rvgi outputs; `at(0)` is the head — feeds the signal. */
    readonly rvgiWindow: Float64RingBuffer;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.rvgi called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, capacity: number): RvgiSlot {
    const rvgiBuf = new Float64RingBuffer(capacity);
    const signalBuf = new Float64RingBuffer(capacity);
    return {
        result: null,
        rvgiBuf,
        signalBuf,
        rvgiSeries: makeSeriesView<number>(rvgiBuf),
        signalSeries: makeSeriesView<number>(signalBuf),
        length,
        coWindow: new Float64RingBuffer(4),
        hlWindow: new Float64RingBuffer(4),
        rvgiWindow: new Float64RingBuffer(4),
    };
}

/**
 * 4-bar `(1, 2, 2, 1) / 6` weighted sum over a `Float64RingBuffer`
 * with `at(0)` = head. Returns NaN if the ring isn't full or any
 * value is non-finite.
 */
function weighted4(ring: Float64RingBuffer): number {
    if (ring.length < 4) return Number.NaN;
    const v0 = ring.at(0);
    const v1 = ring.at(1);
    const v2 = ring.at(2);
    const v3 = ring.at(3);
    if (
        !Number.isFinite(v0) ||
        !Number.isFinite(v1) ||
        !Number.isFinite(v2) ||
        !Number.isFinite(v3)
    ) {
        return Number.NaN;
    }
    return (v0 + 2 * v1 + 2 * v2 + v3) / 6;
}

/**
 * Relative Vigor Index (John Ehlers, 2002). Per-bar 4-bar weighted
 * sum of `(close − open)` (numerator) and `(high − low)` (denominator),
 * each smoothed via an SMA over `length` bars; `rvgi = numSma /
 * denSma`. The signal line is a 4-bar `(1, 2, 2, 1) / 6` weighted sum
 * of the rvgi line. Defaults `length = 10`. Composes 2 `ta.sma`
 * sub-slots (`${slotId}/numSma`, `${slotId}/denSma`).
 *
 * Flat-range bars (denominator SMA = 0) emit NaN at `rvgi`; that NaN
 * propagates into the signal's 4-bar window.
 *
 * @formula  coN = closes[t − N] − opens[t − N] ; hlN = highs[t − N] − lows[t − N] ;
 *           num = (co0 + 2·co1 + 2·co2 + co3) / 6 ; den = (hl0 + 2·hl1 + 2·hl2 + hl3) / 6 ;
 *           rvgi   = sma(num, length) / sma(den, length) ; NaN on den === 0 ;
 *           signal = (rvgi[0] + 2·rvgi[1] + 2·rvgi[2] + rvgi[3]) / 6
 * @warmup   length + 3 (numerator / denominator defined at bar 3 ; sma defined `length − 1` bars later ; signal needs another 3)
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const r = ta.rvgi("slot");
 *     // plot(r.rvgi); plot(r.signal);
 */
export function rvgi(slotId: string, opts?: RvgiOpts): RvgiResult {
    const ctx = getCtx();
    const length = opts?.length ?? DEFAULT_LENGTH;

    let slot = ctx.stream.taSlots.get(slotId) as RvgiSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(length, ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }

    const { open, high, low, close } = ctx.stream.bar;
    const co = Number.isFinite(close) && Number.isFinite(open) ? close - open : Number.NaN;
    const hl = Number.isFinite(high) && Number.isFinite(low) ? high - low : Number.NaN;

    if (ctx.isTick) {
        slot.coWindow.replaceHead(co);
        slot.hlWindow.replaceHead(hl);
    } else {
        slot.coWindow.append(co);
        slot.hlWindow.append(hl);
    }

    const numerator = weighted4(slot.coWindow);
    const denominator = weighted4(slot.hlWindow);

    const numSeries = sma(`${slotId}/numSma`, numerator, length);
    const denSeries = sma(`${slotId}/denSma`, denominator, length);
    const numSma = numSeries.current;
    const denSma = denSeries.current;
    let rvgiValue: number;
    if (!Number.isFinite(numSma) || !Number.isFinite(denSma) || denSma === 0) {
        rvgiValue = Number.NaN;
    } else {
        rvgiValue = numSma / denSma;
    }

    if (ctx.isTick) {
        slot.rvgiWindow.replaceHead(rvgiValue);
        slot.rvgiBuf.replaceHead(rvgiValue);
    } else {
        slot.rvgiWindow.append(rvgiValue);
        slot.rvgiBuf.append(rvgiValue);
    }

    const signalValue = weighted4(slot.rvgiWindow);

    if (ctx.isTick) slot.signalBuf.replaceHead(signalValue);
    else slot.signalBuf.append(signalValue);

    if (slot.result === null) {
        slot.result = Object.freeze({
            rvgi: slot.rvgiSeries,
            signal: slot.signalSeries,
        });
    }
    return slot.result;
}
