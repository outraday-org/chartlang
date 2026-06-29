// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/obv.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. The runtime emits the RAW OBV cumulative
// only; invinite's optional smoothing block is left to the script
// author (`ta.ema(ta.obv(), n)` etc.).

import type { ObvOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView } from "../seriesView.js";

type ObvSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    /** Active cumulative OBV across the closed bars so far. */
    cumObv: number;
    /** Most recent finite close (the lookback target for the next delta). */
    prevClose: number;
    /** Snapshot of `cumObv` BEFORE the most recent close-side update. */
    prevClosedCumObv: number;
    /** Snapshot of `prevClose` BEFORE the most recent close-side update. */
    prevClosedPrevClose: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.obv called outside an active script step");
    }
    return ctx;
}

function initSlot(capacity: number): ObvSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        cumObv: 0,
        prevClose: Number.NaN,
        prevClosedCumObv: 0,
        prevClosedPrevClose: Number.NaN,
    };
}

function signOfDelta(delta: number): number {
    if (delta > 0) return 1;
    if (delta < 0) return -1;
    return 0;
}

/**
 * Compute the (cumObv, prevClose) accumulator state AFTER folding the
 * given bar into the prior (inCumObv, inPrevClose) state. NaN close or
 * NaN volume carries the accumulator forward unchanged (matches
 * invinite's `safeVolume(NaN) === 0` shape under the `prevClose === NaN`
 * first-bar guard).
 */
function fold(
    inCumObv: number,
    inPrevClose: number,
    close: number,
    volume: number,
): { cumObv: number; prevClose: number } {
    if (!Number.isFinite(close)) {
        return { cumObv: inCumObv, prevClose: inPrevClose };
    }
    if (!Number.isFinite(inPrevClose)) {
        // First bar with a defined close — seed `prevClose`, leave
        // `cumObv` at its zero seed.
        return { cumObv: inCumObv, prevClose: close };
    }
    if (!Number.isFinite(volume)) {
        // NaN volume → contribute nothing this bar, but advance
        // `prevClose` so the next delta is well-defined.
        return { cumObv: inCumObv, prevClose: close };
    }
    const direction = signOfDelta(close - inPrevClose);
    return { cumObv: inCumObv + direction * volume, prevClose: close };
}

/**
 * On-Balance Volume — cumulative volume signed by close-vs-prev-close
 * direction. Renders in its own pane (volume category). Flat closes
 * (delta = 0) contribute nothing; NaN volume carries the accumulator
 * forward without an update (matches invinite's `safeVolume`-style
 * defensive shape). The first bar emits `0` (no prior close to
 * difference against — Pine convention).
 *
 * **Tick mode.** Replays the head bar's contribution against a
 * snapshot of the prior-close (cumObv, prevClose) tuple so a partial-
 * bar tick doesn't pollute the next close's accumulator.
 *
 * @formula  obv[t] = obv[t − 1] + sign(close[t] − close[t − 1]) · volume[t]
 * @warmup   1 (needs a prior close to compute the delta; bar 0 emits 0)
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta, plot } from "@invinite-org/chartlang-core";
 *     // const o = ta.obv();
 *     // plot(o);
 */
export function obv(slotId: string, _opts?: ObvOpts): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as ObvSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    // `bar.{close,volume}` are number-coercible series-view proxies — coerce at
    // the read so `fold`'s `Number.isFinite` guards see real numbers.
    const bar = ctx.stream.bar;
    const close = +bar.close;
    const volume = +bar.volume;

    if (ctx.isTick) {
        const next = fold(slot.prevClosedCumObv, slot.prevClosedPrevClose, close, volume);
        slot.outBuffer.replaceHead(next.cumObv);
        return slot.series;
    }

    // Close-side: snapshot the prior-close state, then fold in.
    slot.prevClosedCumObv = slot.cumObv;
    slot.prevClosedPrevClose = slot.prevClose;
    const next = fold(slot.cumObv, slot.prevClose, close, volume);
    slot.cumObv = next.cumObv;
    slot.prevClose = next.prevClose;
    slot.outBuffer.append(slot.cumObv);
    return slot.series;
}
