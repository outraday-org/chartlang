// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/pvt.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. The runtime emits the RAW PVT cumulative
// only; invinite's optional smoothing block is left to the script
// author (`ta.ema(ta.pvt(), n)` etc.).

import type { PvtOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView, makeShiftedSeriesView } from "../seriesView.js";

type PvtSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly shiftedViews: Map<number, Series<number>>;
    /** Active cumulative PVT across the closed bars so far. */
    cumPvt: number;
    /** Most recent finite close (the lookback target for the next delta). */
    prevClose: number;
    /** Snapshot of `cumPvt` BEFORE the most recent close-side update. */
    prevClosedCumPvt: number;
    /** Snapshot of `prevClose` BEFORE the most recent close-side update. */
    prevClosedPrevClose: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.pvt called outside an active script step");
    }
    return ctx;
}

function initSlot(capacity: number): PvtSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        shiftedViews: new Map(),
        cumPvt: 0,
        prevClose: Number.NaN,
        prevClosedCumPvt: 0,
        prevClosedPrevClose: Number.NaN,
    };
}

function viewForOffset(slot: PvtSlot, offset: number): Series<number> {
    if (offset === 0) return slot.series;
    let view = slot.shiftedViews.get(offset);
    if (view === undefined) {
        view = makeShiftedSeriesView<number>(slot.outBuffer, offset);
        slot.shiftedViews.set(offset, view);
    }
    return view;
}

/**
 * Per-bar PVT contribution `volume · (close − prevClose) / prevClose`.
 * Zero `prevClose` is a sentinel for "undefined ratio": we surface NaN
 * so the output bar carries a NaN, AND signal the caller (via
 * `Number.isNaN`) to carry `cumPvt` forward without an update. NaN
 * volume contributes 0; NaN close → 0 (caller short-circuits).
 */
function contribution(prevClose: number, close: number, volume: number): number {
    if (prevClose === 0) return Number.NaN;
    const v = Number.isFinite(volume) ? volume : 0;
    return (v * (close - prevClose)) / prevClose;
}

/**
 * Fold the given bar into the prior `(cum, prevClose)` accumulator.
 * NaN close → carry both forward unchanged (no advance of prevClose).
 * Zero prevClose → output the bar as NaN AND carry `cum` forward
 * (advance prevClose to `close` so the next finite ratio is well-
 * defined). First bar (`prevClose === NaN`) seeds `prevClose = close`
 * and leaves `cum` at its 0 seed.
 */
function fold(
    inCum: number,
    inPrevClose: number,
    close: number,
    volume: number,
): { cum: number; prevClose: number; emit: number } {
    if (!Number.isFinite(close)) {
        return { cum: inCum, prevClose: inPrevClose, emit: inCum };
    }
    if (!Number.isFinite(inPrevClose)) {
        // First defined bar: seed prevClose, output 0 (no prior delta).
        return { cum: inCum, prevClose: close, emit: inCum };
    }
    const c = contribution(inPrevClose, close, volume);
    if (Number.isNaN(c)) {
        // Zero prevClose: carry cum forward, advance prevClose so the
        // next finite ratio is well-defined; emit NaN this bar.
        return { cum: inCum, prevClose: close, emit: Number.NaN };
    }
    const next = inCum + c;
    return { cum: next, prevClose: close, emit: next };
}

/**
 * Price Volume Trend — cumulative `volume · (close − prevClose) /
 * prevClose`. Conceptually similar to OBV but uses the magnitude of
 * the close-pct-change move (not just sign), so the rate of accumulation
 * scales with how strong the bar's move was. The first bar emits `0`
 * (Pine convention — no prior close to difference against).
 *
 * **Tick mode.** Replays the head bar's contribution against a
 * snapshot of the prior-close `(cumPvt, prevClose)` tuple so a partial-
 * bar tick doesn't pollute the next close's accumulator.
 *
 * @formula  pvt[t] = pvt[t − 1] + volume[t] · (close[t] − close[t − 1]) / close[t − 1]
 * @warmup   1 (needs a prior close to compute the delta; bar 0 emits 0)
 * @since 0.2
 * @stable
 *
 * `opts.offset` is a presentation display shift carried to the plot
 * emission as `xShift` (`+n` right / future, `−n` left / past); the
 * series value is unshifted.
 *
 * @example
 *     // import { ta, plot } from "@invinite-org/chartlang-core";
 *     // const p = ta.pvt();
 *     // plot(p);
 */
export function pvt(slotId: string, opts?: PvtOpts): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as PvtSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const offset = opts?.offset ?? 0;
    // `bar.{close,volume}` are number-coercible series-view proxies — coerce at
    // the read so `fold`'s `Number.isFinite` guards see real numbers.
    const bar = ctx.stream.bar;
    const close = +bar.close;
    const volume = +bar.volume;

    if (ctx.isTick) {
        const next = fold(slot.prevClosedCumPvt, slot.prevClosedPrevClose, close, volume);
        slot.outBuffer.replaceHead(next.emit);
        return viewForOffset(slot, offset);
    }

    slot.prevClosedCumPvt = slot.cumPvt;
    slot.prevClosedPrevClose = slot.prevClose;
    const next = fold(slot.cumPvt, slot.prevClose, close, volume);
    slot.cumPvt = next.cum;
    slot.prevClose = next.prevClose;
    slot.outBuffer.append(next.emit);
    return viewForOffset(slot, offset);
}
