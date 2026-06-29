// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/klinger.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. Composition: three `ta.ema` sub-slots
// (`${slotId}/fastEma`, `${slotId}/slowEma`, `${slotId}/signalEma`).
// The Volume Force accumulator (trend / cm / dm) is bespoke
// per-primitive state — no registry helper expresses VF.

import type { KlingerOpts, KlingerResult, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView } from "../seriesView.js";
import { ema } from "./ema.js";

const DEFAULT_FAST_LENGTH = 34;
const DEFAULT_SLOW_LENGTH = 55;
const DEFAULT_SIGNAL_LENGTH = 13;

type KlingerSlot = {
    result: KlingerResult | null;
    readonly klingerBuf: Float64RingBuffer;
    readonly klingerSeries: Series<number>;
    /** Active per-bar accumulator (closed-side, post most-recent close). */
    prevHlc: number;
    prevTrend: number;
    prevCm: number;
    prevDm: number;
    /** Snapshot BEFORE the most recent close — used by tick replay. */
    prevClosedHlc: number;
    prevClosedTrend: number;
    prevClosedCm: number;
    prevClosedDm: number;
    barCount: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.klinger called outside an active script step");
    }
    return ctx;
}

function initSlot(capacity: number): KlingerSlot {
    const klingerBuf = new Float64RingBuffer(capacity);
    return {
        result: null,
        klingerBuf,
        klingerSeries: makeSeriesView<number>(klingerBuf),
        prevHlc: Number.NaN,
        prevTrend: 0,
        prevCm: 0,
        prevDm: 0,
        prevClosedHlc: Number.NaN,
        prevClosedTrend: 0,
        prevClosedCm: 0,
        prevClosedDm: 0,
        barCount: 0,
    };
}

/**
 * Volume Force given the bar OHLCV + the prior bar's (hlc, trend, cm,
 * dm) snapshot. Returns the new (vf, trend, cm, dm) tuple.
 *
 * `vf = volume · |2 · (dm / cm − 1)| · trend · 100` when `cm` is
 * finite and non-zero; else `vf = 0`. NaN price inputs hold the prior
 * state forward (vf = 0).
 */
function computeVf(
    high: number,
    low: number,
    close: number,
    volume: number,
    baseHlc: number,
    baseTrend: number,
    baseCm: number,
    baseDm: number,
): { vf: number; hlc: number; trend: number; cm: number; dm: number } {
    if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
        return { vf: 0, hlc: baseHlc, trend: baseTrend, cm: baseCm, dm: baseDm };
    }
    const hlc = high + low + close;
    const dm = high - low;
    let trend: number;
    if (!Number.isFinite(baseHlc)) {
        // First bar — no prior HLC. Seed trend = 0 (matches invinite's
        // initialisation: `prevTrend = 0`), emit vf = 0, propagate
        // baseDm = dm (subsequent bar's cm starts from this dm).
        return { vf: 0, hlc, trend: 0, cm: 0, dm };
    }
    if (hlc > baseHlc) trend = 1;
    else if (hlc < baseHlc) trend = -1;
    else trend = baseTrend;
    const cm = trend === baseTrend ? baseCm + dm : baseDm + dm;
    // Defensive: volume / vf-finite guards. Outer call site has already
    // checked high / low / close are finite; volume can still be NaN on
    // some exchanges, but the runtime feeds a finite default elsewhere.
    /* c8 ignore next */
    const volumeFinite = Number.isFinite(volume) ? volume : 0;
    let vf = 0;
    if (cm !== 0 && Number.isFinite(cm)) {
        vf = volumeFinite * Math.abs(2 * (dm / cm - 1)) * trend * 100;
        /* c8 ignore next */
        if (!Number.isFinite(vf)) vf = 0;
    }
    return { vf, hlc, trend, cm, dm };
}

/**
 * Klinger Volume Oscillator. Per-bar Volume Force accumulator drives
 * the difference of two EMAs (`fastLength` / `slowLength`); the
 * signal line is a third EMA over the Klinger line. Defaults
 * `(34, 55, 13)`. Composes 3 `ta.ema` sub-slots (`${slotId}/fastEma`,
 * `${slotId}/slowEma`, `${slotId}/signalEma`). The user-facing
 * `signal` Series IS the signalEma sub-slot's own Series view.
 *
 * Zero-volume bars emit `vf = 0` (no contribution); this matches
 * invinite's `safeVolume`-style shape and the task spec's "no VF
 * update" wording — zero-VF still flows into the EMAs, it just adds
 * zero. The first bar emits `vf = 0` (seed only — no prior HLC to
 * difference against).
 *
 * @formula  hlc[t] = high + low + close ;
 *           trend  = hlc > prevHlc ? +1 : hlc < prevHlc ? −1 : prevTrend ;
 *           dm     = high − low ; cm = trend === prevTrend ? prevCm + dm : prevDm + dm ;
 *           vf     = cm ≠ 0 ? volume · |2·(dm/cm − 1)| · trend · 100 : 0 ;
 *           klinger = ema(vf, fastLength) − ema(vf, slowLength) ;
 *           signal  = ema(klinger, signalLength)
 * @warmup   slowLength + signalLength − 2
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const k = ta.klinger("slot");
 *     // plot(k.klinger); plot(k.signal);
 */
export function klinger(slotId: string, opts?: KlingerOpts): KlingerResult {
    const ctx = getCtx();
    const fastLength = opts?.fastLength ?? DEFAULT_FAST_LENGTH;
    const slowLength = opts?.slowLength ?? DEFAULT_SLOW_LENGTH;
    const signalLength = opts?.signalLength ?? DEFAULT_SIGNAL_LENGTH;

    let slot = ctx.stream.taSlots.get(slotId) as KlingerSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }

    // `bar.{high,low,close,volume}` are number-coercible series-view proxies —
    // coerce at the read so `computeVf`'s `Number.isFinite` guards see real
    // numbers.
    const bar = ctx.stream.bar;
    const high = +bar.high;
    const low = +bar.low;
    const close = +bar.close;
    const volume = +bar.volume;

    let vf: number;
    if (ctx.isTick) {
        // Replay the head's VF against the prior-close snapshot.
        const step = computeVf(
            high,
            low,
            close,
            volume,
            slot.prevClosedHlc,
            slot.prevClosedTrend,
            slot.prevClosedCm,
            slot.prevClosedDm,
        );
        vf = step.vf;
    } else {
        // Close-side. Snapshot prior-close BEFORE folding in.
        slot.prevClosedHlc = slot.prevHlc;
        slot.prevClosedTrend = slot.prevTrend;
        slot.prevClosedCm = slot.prevCm;
        slot.prevClosedDm = slot.prevDm;
        const step = computeVf(
            high,
            low,
            close,
            volume,
            slot.prevHlc,
            slot.prevTrend,
            slot.prevCm,
            slot.prevDm,
        );
        vf = step.vf;
        slot.prevHlc = step.hlc;
        slot.prevTrend = step.trend;
        slot.prevCm = step.cm;
        slot.prevDm = step.dm;
        slot.barCount += 1;
    }

    const fastSeries = ema(`${slotId}/fastEma`, vf, fastLength);
    const slowSeries = ema(`${slotId}/slowEma`, vf, slowLength);
    const fa = fastSeries.current;
    const sa = slowSeries.current;
    const klingerValue = Number.isFinite(fa) && Number.isFinite(sa) ? fa - sa : Number.NaN;

    if (ctx.isTick) slot.klingerBuf.replaceHead(klingerValue);
    else slot.klingerBuf.append(klingerValue);

    const signalSeries = ema(`${slotId}/signalEma`, klingerValue, signalLength);

    if (slot.result === null) {
        slot.result = Object.freeze({
            klinger: slot.klingerSeries,
            signal: signalSeries,
        });
    }
    return slot.result;
}
