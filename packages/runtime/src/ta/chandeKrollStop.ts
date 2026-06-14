// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/chande-kroll-stop.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. ChandeKrollStop composes Phase-1 `ta.atr`
// plus Task-5 `ta.highest` / `ta.lowest` at sub-slots
// `${slotId}/atr` / `${slotId}/highHigh` / `${slotId}/lowLow` for the
// first pass, then walks a self-owned `Float64RingBuffer` window of
// size `smoothingLength` for the second-pass max/min. The opts
// naming (`length` / `multiplier` / `smoothingLength`) matches
// Chande Kroll's 1995 paper — `length` is the ATR period AND the
// first-pass rolling extreme window, `smoothingLength` is the
// second-pass extreme window.

import type { ChandeKrollStopOpts, ChandeKrollStopResult } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView } from "../seriesView.js";
import { atr } from "./atr.js";
import { highest } from "./highest.js";
import { lowest } from "./lowest.js";

const DEFAULT_LENGTH = 10;
const DEFAULT_MULTIPLIER = 1;
const DEFAULT_SMOOTHING = 9;

type ChandeKrollStopSlot = {
    readonly outputs: ChandeKrollStopResult;
    readonly longBuffer: Float64RingBuffer;
    readonly shortBuffer: Float64RingBuffer;
    readonly length: number;
    readonly multiplier: number;
    readonly smoothingLength: number;
    /**
     * First-pass long/high stops across the trailing `smoothingLength`
     * CLOSED bars. `at(0)` is the most recent close.
     */
    readonly firstHighWindow: Float64RingBuffer;
    /** First-pass short/low stops across the trailing window. */
    readonly firstLowWindow: Float64RingBuffer;
    /** Number of CLOSED bars folded into the slot so far. */
    barCount: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.chandeKrollStop called outside an active script step");
    }
    return ctx;
}

function initSlot(
    capacity: number,
    length: number,
    multiplier: number,
    smoothingLength: number,
): ChandeKrollStopSlot {
    const longBuffer = new Float64RingBuffer(capacity);
    const shortBuffer = new Float64RingBuffer(capacity);
    return {
        outputs: Object.freeze({
            long: makeSeriesView<number>(longBuffer),
            short: makeSeriesView<number>(shortBuffer),
        }),
        longBuffer,
        shortBuffer,
        length,
        multiplier,
        smoothingLength,
        firstHighWindow: new Float64RingBuffer(smoothingLength),
        firstLowWindow: new Float64RingBuffer(smoothingLength),
        barCount: 0,
    };
}

function firstPass(
    hi: number,
    lo: number,
    atrValue: number,
    multiplier: number,
): { firstHigh: number; firstLow: number } {
    if (!Number.isFinite(hi) || !Number.isFinite(lo) || !Number.isFinite(atrValue)) {
        return { firstHigh: Number.NaN, firstLow: Number.NaN };
    }
    return {
        firstHigh: hi - multiplier * atrValue,
        firstLow: lo + multiplier * atrValue,
    };
}

/**
 * Scan `window.at(start)..at(end)` (inclusive of start, exclusive of
 * end+1) for the max of finite entries. Returns `NaN` if no finite
 * entry exists.
 */
function maxOver(
    window: Float64RingBuffer,
    headOverride: number,
    startExclusiveOfHead: boolean,
    smoothingLength: number,
): number {
    let best = Number.NEGATIVE_INFINITY;
    if (Number.isFinite(headOverride)) best = headOverride;
    const startAge = startExclusiveOfHead ? 1 : 0;
    const filled = window.length;
    for (let k = startAge; k < filled && k < smoothingLength; k += 1) {
        const v = window.at(k);
        if (Number.isFinite(v) && v > best) best = v;
    }
    return best === Number.NEGATIVE_INFINITY ? Number.NaN : best;
}

function minOver(
    window: Float64RingBuffer,
    headOverride: number,
    startExclusiveOfHead: boolean,
    smoothingLength: number,
): number {
    let best = Number.POSITIVE_INFINITY;
    if (Number.isFinite(headOverride)) best = headOverride;
    const startAge = startExclusiveOfHead ? 1 : 0;
    const filled = window.length;
    for (let k = startAge; k < filled && k < smoothingLength; k += 1) {
        const v = window.at(k);
        if (Number.isFinite(v) && v < best) best = v;
    }
    return best === Number.POSITIVE_INFINITY ? Number.NaN : best;
}

/**
 * Chande Kroll Stop — two-pass ATR-offset trailing stops. The first
 * pass anchors each bar to its `length`-bar high/low extreme minus /
 * plus `multiplier · ATR`; the second pass smooths the first-pass
 * stops by taking the rolling max / min over a `smoothingLength`-bar
 * window. `long` is the long-trade trailing stop ceiling (max of
 * `firstHigh`), `short` is the short-trade trailing stop floor (min
 * of `firstLow`). Composes `ta.atr` plus `ta.highest`
 * and `ta.lowest` at sub-slots.
 *
 * Source field is hard-coded to `bar.high` / `bar.low` (matches Pine
 * `ta.cks` and the canonical TradingView CKS). Invinite's `source`
 * parameter is omitted; a `source` opt could land in a follow-up.
 *
 * NaN ATR or NaN extreme → NaN at both first-pass and second-pass
 * outputs for that bar (the rolling window retains the NaN slot;
 * downstream max/min skip NaN entries via `Number.isFinite`).
 *
 * @formula  firstHigh = highest(bar.high, length) − multiplier · atr(length) ;
 *           firstLow  = lowest(bar.low,   length) + multiplier · atr(length) ;
 *           long  = max(firstHigh over smoothingLength bars) ;
 *           short = min(firstLow  over smoothingLength bars)
 * @warmup   length + smoothingLength − 1
 * @anchors  length, multiplier
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const c = ta.chandeKrollStop({ length: 10, multiplier: 1, smoothingLength: 9 });
 *     // plot(c.long);
 *     // plot(c.short);
 */
export function chandeKrollStop(slotId: string, opts?: ChandeKrollStopOpts): ChandeKrollStopResult {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as ChandeKrollStopSlot | undefined;
    if (slot === undefined) {
        const length = opts?.length ?? DEFAULT_LENGTH;
        const multiplier = opts?.multiplier ?? DEFAULT_MULTIPLIER;
        const smoothingLength = opts?.smoothingLength ?? DEFAULT_SMOOTHING;
        slot = initSlot(ctx.stream.ohlcv.close.capacity, length, multiplier, smoothingLength);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const bar = ctx.stream.bar;
    // Compose: ta.atr + ta.highest + ta.lowest at sub-slots. Each
    // sub-slot owns its own tick replay; the head reads below are
    // correct in both close and tick contexts.
    const atrSeries = atr(`${slotId}/atr`, slot.length);
    const highSeries = highest(`${slotId}/highHigh`, bar.high, slot.length);
    const lowSeries = lowest(`${slotId}/lowLow`, bar.low, slot.length);

    const { firstHigh, firstLow } = firstPass(
        highSeries.current,
        lowSeries.current,
        atrSeries.current,
        slot.multiplier,
    );

    if (ctx.isTick) {
        // Second pass: scan the CLOSED window (excluding head) plus the
        // tick's first-pass value as the candidate for age 0.
        const long = maxOver(slot.firstHighWindow, firstHigh, true, slot.smoothingLength);
        const short = minOver(slot.firstLowWindow, firstLow, true, slot.smoothingLength);
        // Output is NaN unless both first-pass passes are warm AND the
        // smoothing window has enough closed entries (>= smoothingLength).
        // The closed window has `min(barCount, smoothingLength)` entries;
        // the tick adds one more candidate. So second-pass warm requires
        // `barCount >= smoothingLength`.
        const warm = slot.barCount >= slot.smoothingLength;
        slot.longBuffer.replaceHead(warm ? long : Number.NaN);
        slot.shortBuffer.replaceHead(warm ? short : Number.NaN);
    } else {
        slot.firstHighWindow.append(firstHigh);
        slot.firstLowWindow.append(firstLow);
        slot.barCount += 1;
        // Second-pass warmup needs `smoothingLength` first-pass bars
        // (matches invinite's `secondValidIdx = firstValidIdx + pLength
        // - 1`, which is `length - 1 + smoothingLength - 1` — i.e.
        // `barCount >= length + smoothingLength - 1`). With invinite's
        // `firstValidIdx = max(length - 1, length - 1)`, the second
        // valid index is `length + smoothingLength - 2` (0-based), so
        // bar `length + smoothingLength - 1` (1-based barCount) is the
        // first warm bar.
        const warm = slot.barCount >= slot.length + slot.smoothingLength - 1;
        if (!warm) {
            slot.longBuffer.append(Number.NaN);
            slot.shortBuffer.append(Number.NaN);
        } else {
            // Second pass over the full window (head included).
            const long = maxOver(slot.firstHighWindow, Number.NaN, false, slot.smoothingLength);
            const short = minOver(slot.firstLowWindow, Number.NaN, false, slot.smoothingLength);
            slot.longBuffer.append(long);
            slot.shortBuffer.append(short);
        }
    }
    return slot.outputs;
}
