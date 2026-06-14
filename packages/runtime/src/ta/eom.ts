// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/eom.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. The `length`-bar SMA over the raw EOM
// series is inlined (rather than composed via a `ta.sma` sub-slot)
// because each per-bar rawEom is a scalar derived from H/L/V + the
// per-slot `prevMid` state — feeding it through SMA's `Series`-or-
// scalar surface would be more friction than the trailing-window
// running sum below.

import type { EomOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView, makeShiftedSeriesView } from "../seriesView.js";

/**
 * Hard-coded divisor matching invinite's default
 * (`indicators/eom.ts:37` ships `divisor: 10000` as the
 * conventional choice). TV's published example uses 100 000 000 and
 * explicitly warns the divisor "should be adjusted based on trading
 * volume" — there is no canonical default. We pin invinite's default;
 * scripts that want a different scale can multiply the output.
 */
const DIVISOR = 10000;

type EomSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly shiftedViews: Map<number, Series<number>>;
    readonly length: number;
    /**
     * Closed-bar raw-EOM values across the trailing `length` bars
     * (capacity `length`). `at(0)` is the head (most recent); older
     * slots index upward.
     */
    readonly rawEomWindow: Float64RingBuffer;
    /** Running sum of `rawEomWindow` (over only the finite entries). */
    sumRawEom: number;
    /** Count of NaN entries in `rawEomWindow` — forces NaN output when > 0. */
    nanCount: number;
    /** Midpoint of the most recent closed bar (NaN before bar 0 lands). */
    prevMid: number;
    /**
     * Midpoint of the bar BEFORE the most recent close — needed so a
     * tick can recompute the head bar's rawEom against the same prevMid
     * the close-side update used. Snapshotted at the START of every
     * close-side update.
     */
    prevPrevMid: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.eom called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, capacity: number): EomSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        shiftedViews: new Map(),
        length,
        rawEomWindow: new Float64RingBuffer(length),
        sumRawEom: 0,
        nanCount: 0,
        prevMid: Number.NaN,
        prevPrevMid: Number.NaN,
    };
}

function viewForOffset(slot: EomSlot, offset: number): Series<number> {
    if (offset === 0) return slot.series;
    let view = slot.shiftedViews.get(offset);
    if (view === undefined) {
        view = makeShiftedSeriesView<number>(slot.outBuffer, offset);
        slot.shiftedViews.set(offset, view);
    }
    return view;
}

function safeVol(volume: number): number {
    return Number.isFinite(volume) ? volume : 0;
}

/**
 * Per-bar raw EOM `(midpointMove) / boxRatio`. Returns NaN when the
 * range is zero (no movement, boxRatio undefined), boxRatio is zero
 * (volume-free bar), prevMid is NaN (first bar), or any input is NaN.
 */
function rawEomAt(high: number, low: number, volume: number, prevMid: number): number {
    if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(prevMid)) {
        return Number.NaN;
    }
    const range = high - low;
    if (range === 0) return Number.NaN;
    const boxRatio = safeVol(volume) / DIVISOR / range;
    if (boxRatio === 0) return Number.NaN;
    const midpointMove = (high + low) / 2 - prevMid;
    return midpointMove / boxRatio;
}

/**
 * Emit the SMA over `rawEomWindow` once it's full AND contains no
 * NaN entries. Pre-warmup OR any NaN in the window → NaN.
 */
function emit(slot: EomSlot, ready: boolean): number {
    if (!ready || slot.nanCount > 0) return Number.NaN;
    return slot.sumRawEom / slot.length;
}

/**
 * Ease of Movement — `length`-bar SMA of per-bar `(midpointMove) /
 * (boxRatio)` where `midpointMove = mid[t] − mid[t − 1]` and
 * `boxRatio = (volume / divisor) / (high − low)`. Zero-range bars,
 * zero-volume bars, and any NaN input produce a NaN slot in the
 * window; the window SMA propagates NaN — any NaN in the trailing
 * `length` slots forces the output to NaN (forces a clean restart
 * after a flat / NaN bar). The hard-coded divisor matches invinite's
 * default of `10000`.
 *
 * **Tick mode.** Computes the tick's rawEom against the snapshot
 * prevMid, substitutes it for the head slot in the trailing window
 * (`hypSum = sum − headRawEom + tickRawEom`), and emits
 * `hypSum / length` if the window is full AND `hypNanCount === 0`,
 * else NaN. Does NOT mutate the closed window.
 *
 * @formula  rawEom[t] = ((high[t] + low[t]) / 2 − (high[t − 1] + low[t − 1]) / 2)
 *                       / ((volume[t] / 10000) / (high[t] − low[t])) ;
 *           eom[t]    = SMA(rawEom, length)[t] ;
 *           any NaN in the window → NaN
 * @warmup   length (first defined output at bar `length`; bar 1 has the
 *           first finite rawEom; the window needs `length` such values)
 * @since 0.2
 * @stable
 *
 * `opts.offset` shifts the returned series.
 *
 * @example
 *     // import { ta, plot } from "@invinite-org/chartlang-core";
 *     // const e = ta.eom(14);
 *     // plot(e);
 */
export function eom(slotId: string, length: number, opts?: EomOpts): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as EomSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(length, ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const offset = opts?.offset ?? 0;
    const { high, low, volume } = ctx.stream.bar;

    if (ctx.isTick) {
        // Tick replay against the closed window: recompute the head
        // bar's rawEom against the SAME prevMid the close used (which
        // is the prior bar's midpoint = `prevPrevMid`), substitute it
        // for the head slot in the trailing window without mutating
        // the window. `sumRawEom` + `nanCount` already reflect the
        // post-close state; subtract the current head and add the tick's
        // rawEom. Pre-warmup ticks emit NaN.
        if (slot.rawEomWindow.length < slot.length) {
            slot.outBuffer.replaceHead(Number.NaN);
            return viewForOffset(slot, offset);
        }
        const tickRaw = rawEomAt(high, low, volume, slot.prevPrevMid);
        const headRaw = slot.rawEomWindow.at(0);
        const headWasNaN = !Number.isFinite(headRaw);
        const tickIsNaN = !Number.isFinite(tickRaw);
        const hypNan = slot.nanCount - (headWasNaN ? 1 : 0) + (tickIsNaN ? 1 : 0);
        if (hypNan > 0) {
            slot.outBuffer.replaceHead(Number.NaN);
            return viewForOffset(slot, offset);
        }
        // When we reach here `hypNan === 0`, which guarantees
        // `tickIsNaN === false` (the only way nanCount could decrement
        // is via the head being NaN and the tick being finite). The
        // `headWasNaN ? 0 : headRaw` guards against subtracting a NaN
        // headRaw when the head slot was NaN.
        const hypSum = slot.sumRawEom - (headWasNaN ? 0 : headRaw) + tickRaw;
        slot.outBuffer.replaceHead(hypSum / slot.length);
        return viewForOffset(slot, offset);
    }

    // Close-side: snapshot the bar-before-last's midpoint (so a tick on
    // the new head bar can recompute its rawEom against the same
    // prevMid the close used), then fold the new rawEom into the window.
    slot.prevPrevMid = slot.prevMid;

    const raw = rawEomAt(high, low, volume, slot.prevMid);
    const midpoint =
        Number.isFinite(high) && Number.isFinite(low) ? (high + low) / 2 : slot.prevMid;

    // Evict the oldest slot if the ring is full.
    if (slot.rawEomWindow.length === slot.length) {
        const oldest = slot.rawEomWindow.at(slot.length - 1);
        if (Number.isFinite(oldest)) slot.sumRawEom -= oldest;
        else slot.nanCount -= 1;
    }
    // Append the new rawEom + update sum / nanCount.
    slot.rawEomWindow.append(raw);
    if (Number.isFinite(raw)) slot.sumRawEom += raw;
    else slot.nanCount += 1;
    slot.prevMid = midpoint;

    const ready = slot.rawEomWindow.length === slot.length;
    slot.outBuffer.append(emit(slot, ready));
    return viewForOffset(slot, offset);
}
