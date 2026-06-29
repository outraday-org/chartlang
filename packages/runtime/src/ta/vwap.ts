// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/vwap.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape.

import type { Series, VwapOpts } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView } from "../seriesView.js";

type VwapSource = NonNullable<VwapOpts["source"]>;

const DEFAULT_SOURCE: VwapSource = "hlc3";
const MS_PER_DAY = 86_400_000;

type VwapSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    /** Active cumulative price·volume within the current UTC day. */
    cumPV: number;
    /** Active cumulative volume within the current UTC day. */
    cumV: number;
    /** UTC-day index of the most recent close: `floor(bar.time / 86_400_000)`. */
    currentDayKey: number;
    /** Snapshot of `cumPV` BEFORE the most recent close-side update. */
    prevClosedCumPV: number;
    /** Snapshot of `cumV` BEFORE the most recent close-side update. */
    prevClosedCumV: number;
    /** Snapshot of `currentDayKey` BEFORE the most recent close-side update. */
    prevClosedDayKey: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.vwap called outside an active script step");
    }
    return ctx;
}

function initSlot(capacity: number): VwapSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        cumPV: 0,
        cumV: 0,
        currentDayKey: Number.NaN,
        prevClosedCumPV: 0,
        prevClosedCumV: 0,
        prevClosedDayKey: Number.NaN,
    };
}

function readSource(ctx: RuntimeContext, source: VwapSource): number {
    // The `bar.*` source fields are number-coercible series-view proxies, not
    // real numbers — coerce so `fold`'s `Number.isFinite(src)` guard works.
    switch (source) {
        case "close":
            return +ctx.stream.bar.close;
        case "hl2":
            return +ctx.stream.bar.hl2;
        case "hlc3":
            return +ctx.stream.bar.hlc3;
        case "ohlc4":
            return +ctx.stream.bar.ohlc4;
        case "hlcc4":
            return +ctx.stream.bar.hlcc4;
    }
}

function dayKeyOf(time: number): number {
    return Math.floor(time / MS_PER_DAY);
}

/**
 * Fold one bar into a (cumPV, cumV, dayKey) accumulator and return
 * the post-fold tuple. The first arg is the accumulator state coming
 * in; the result is the state after consuming the bar.
 *
 * Resets the cumulative pair to zero when `dayKey` changes from the
 * incoming `inDayKey`. NaN source or NaN/non-finite volume contributes
 * zero (keeps the running average stable across data gaps); the day
 * boundary still triggers the reset.
 */
function fold(
    inCumPV: number,
    inCumV: number,
    inDayKey: number,
    dayKey: number,
    src: number,
    volume: number,
): { cumPV: number; cumV: number; dayKey: number } {
    let cumPV = inCumPV;
    let cumV = inCumV;
    if (inDayKey !== dayKey) {
        cumPV = 0;
        cumV = 0;
    }
    if (Number.isFinite(src) && Number.isFinite(volume) && volume > 0) {
        cumPV += src * volume;
        cumV += volume;
    }
    return { cumPV, cumV, dayKey };
}

function valueFromCum(cumPV: number, cumV: number): number {
    if (cumV === 0) return Number.NaN;
    return cumPV / cumV;
}

/**
 * Volume-Weighted Average Price (VWAP), session-anchored to the UTC
 * calendar day. Accumulates `Σ(source · volume) / Σ(volume)` over
 * the bars since the most recent UTC midnight; resets to NaN at the
 * top of every UTC day. `source` defaults to `"hlc3"` per Pine.
 *
 * **Session boundary.** The session reset keys off
 * `floor(bar.time / 86_400_000)` (the UTC calendar day). A future
 * release lifts session detection to `syminfo.session.regularStart` per
 * invinite — until then VWAP behaves as a UTC-day-anchored VWAP.
 *
 * **NaN handling.** Bars with NaN source or non-positive / NaN volume
 * contribute zero to the accumulator (the average stays well-defined
 * across data gaps). The first bar of every new day before any
 * volume accumulates yields NaN (`cumV === 0`).
 *
 * **Tick mode.** Replays the head bar's contribution against a
 * snapshot of the prior-close (cumPV, cumV, dayKey) tuple so a
 * partial-bar tick doesn't pollute the next close's accumulator.
 *
 * @formula  vwap[t] = Σ_{u ∈ session(t)}(source[u] · volume[u]) / Σ_{u ∈ session(t)}(volume[u])
 * @warmup   0 (NaN until the first bar with cumV > 0 in the session)
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const v = ta.vwap("slot", { source: "hlc3" });
 *     // const head = v.current;
 */
export function vwap(slotId: string, opts?: VwapOpts): Series<number> {
    const ctx = getCtx();
    const source = opts?.source ?? DEFAULT_SOURCE;
    let slot = ctx.stream.taSlots.get(slotId) as VwapSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const src = readSource(ctx, source);
    const volume = +ctx.stream.bar.volume;
    const dayKey = dayKeyOf(ctx.stream.bar.time);

    if (ctx.isTick) {
        const next = fold(
            slot.prevClosedCumPV,
            slot.prevClosedCumV,
            slot.prevClosedDayKey,
            dayKey,
            src,
            volume,
        );
        slot.outBuffer.replaceHead(valueFromCum(next.cumPV, next.cumV));
        return slot.series;
    }

    // Close-side: snapshot the prior-close state, then fold in the new bar.
    slot.prevClosedCumPV = slot.cumPV;
    slot.prevClosedCumV = slot.cumV;
    slot.prevClosedDayKey = slot.currentDayKey;
    const next = fold(slot.cumPV, slot.cumV, slot.currentDayKey, dayKey, src, volume);
    slot.cumPV = next.cumPV;
    slot.cumV = next.cumV;
    slot.currentDayKey = next.dayKey;
    slot.outBuffer.append(valueFromCum(slot.cumPV, slot.cumV));
    return slot.series;
}
