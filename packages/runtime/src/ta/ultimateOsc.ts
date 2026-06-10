// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/ultimate-osc.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. Ultimate Oscillator derives from
// `bar.high` / `bar.low` / `bar.close` directly (no `source` arg).
// Three pairs of (buying-pressure, true-range) ring buffers + running
// sums — one pair per (shortLength | mediumLength | longLength)
// window. Zero-TR-window emits `NaN`.

import type { Series, UltimateOscOpts } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView } from "../seriesView";

const DEFAULT_SHORT_LENGTH = 7;
const DEFAULT_MEDIUM_LENGTH = 14;
const DEFAULT_LONG_LENGTH = 28;

type UltimateOscSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly shortLength: number;
    readonly mediumLength: number;
    readonly longLength: number;
    readonly bpShort: Float64RingBuffer;
    readonly bpMedium: Float64RingBuffer;
    readonly bpLong: Float64RingBuffer;
    readonly trShort: Float64RingBuffer;
    readonly trMedium: Float64RingBuffer;
    readonly trLong: Float64RingBuffer;
    sumBpShort: number;
    sumBpMedium: number;
    sumBpLong: number;
    sumTrShort: number;
    sumTrMedium: number;
    sumTrLong: number;
    /** Number of closed bars folded into the slot so far. */
    barCount: number;
    /** Close of the most recent closed bar — used by tick mode. */
    prevClose: number;
    /** Close of the bar before the most recent closed bar — used by tick mode. */
    prevPrevClose: number;
    /** bp / tr of the most recent closed bar (per window) — used by tick mode. */
    headBpShort: number;
    headBpMedium: number;
    headBpLong: number;
    headTrShort: number;
    headTrMedium: number;
    headTrLong: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.ultimateOsc called outside an active script step");
    }
    return ctx;
}

function initSlot(
    shortLength: number,
    mediumLength: number,
    longLength: number,
    capacity: number,
): UltimateOscSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        shortLength,
        mediumLength,
        longLength,
        bpShort: new Float64RingBuffer(shortLength),
        bpMedium: new Float64RingBuffer(mediumLength),
        bpLong: new Float64RingBuffer(longLength),
        trShort: new Float64RingBuffer(shortLength),
        trMedium: new Float64RingBuffer(mediumLength),
        trLong: new Float64RingBuffer(longLength),
        sumBpShort: 0,
        sumBpMedium: 0,
        sumBpLong: 0,
        sumTrShort: 0,
        sumTrMedium: 0,
        sumTrLong: 0,
        barCount: 0,
        prevClose: Number.NaN,
        prevPrevClose: Number.NaN,
        headBpShort: 0,
        headBpMedium: 0,
        headBpLong: 0,
        headTrShort: 0,
        headTrMedium: 0,
        headTrLong: 0,
    };
}

function computeBpTr(
    high: number,
    low: number,
    close: number,
    prevClose: number,
): [number, number] {
    // First bar (no prevClose) — invinite seeds bp = tr = 0 so the
    // running sums kick off at zero. We mirror that.
    if (!Number.isFinite(prevClose)) return [0, 0];
    const trueLow = Math.min(low, prevClose);
    const trueHigh = Math.max(high, prevClose);
    return [close - trueLow, trueHigh - trueLow];
}

function pushToWindow(
    ring: Float64RingBuffer,
    sum: number,
    incoming: number,
    capacity: number,
): { newSum: number; outgoing: number } {
    let outgoing = 0;
    if (ring.length >= capacity) {
        outgoing = ring.at(capacity - 1);
    }
    ring.append(incoming);
    return { newSum: sum + incoming - outgoing, outgoing };
}

function uoFromSums(
    sumBpShort: number,
    sumTrShort: number,
    sumBpMedium: number,
    sumTrMedium: number,
    sumBpLong: number,
    sumTrLong: number,
): number {
    if (sumTrShort === 0 || sumTrMedium === 0 || sumTrLong === 0) return Number.NaN;
    const avgShort = sumBpShort / sumTrShort;
    const avgMedium = sumBpMedium / sumTrMedium;
    const avgLong = sumBpLong / sumTrLong;
    return (100 * (4 * avgShort + 2 * avgMedium + avgLong)) / 7;
}

function closeValue(slot: UltimateOscSlot, high: number, low: number, close: number): number {
    if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
        // Hold prior — do not advance window state; emit NaN if unwarmed.
        /* c8 ignore next */
        if (slot.barCount < slot.longLength) return Number.NaN;
        return uoFromSums(
            slot.sumBpShort,
            slot.sumTrShort,
            slot.sumBpMedium,
            slot.sumTrMedium,
            slot.sumBpLong,
            slot.sumTrLong,
        );
    }
    const [bp, tr] = computeBpTr(high, low, close, slot.prevClose);
    const short = pushToWindow(slot.bpShort, slot.sumBpShort, bp, slot.shortLength);
    slot.sumBpShort = short.newSum;
    const medium = pushToWindow(slot.bpMedium, slot.sumBpMedium, bp, slot.mediumLength);
    slot.sumBpMedium = medium.newSum;
    const long = pushToWindow(slot.bpLong, slot.sumBpLong, bp, slot.longLength);
    slot.sumBpLong = long.newSum;
    const trShort = pushToWindow(slot.trShort, slot.sumTrShort, tr, slot.shortLength);
    slot.sumTrShort = trShort.newSum;
    const trMedium = pushToWindow(slot.trMedium, slot.sumTrMedium, tr, slot.mediumLength);
    slot.sumTrMedium = trMedium.newSum;
    const trLong = pushToWindow(slot.trLong, slot.sumTrLong, tr, slot.longLength);
    slot.sumTrLong = trLong.newSum;

    slot.prevPrevClose = slot.prevClose;
    slot.prevClose = close;
    slot.barCount += 1;

    // Capture the new head's bp/tr per window for tick-mode replay.
    slot.headBpShort = bp;
    slot.headBpMedium = bp;
    slot.headBpLong = bp;
    slot.headTrShort = tr;
    slot.headTrMedium = tr;
    slot.headTrLong = tr;

    if (slot.barCount < slot.longLength) return Number.NaN;
    return uoFromSums(
        slot.sumBpShort,
        slot.sumTrShort,
        slot.sumBpMedium,
        slot.sumTrMedium,
        slot.sumBpLong,
        slot.sumTrLong,
    );
}

function tickValue(slot: UltimateOscSlot, high: number, low: number, close: number): number {
    if (slot.barCount < slot.longLength) return Number.NaN;
    if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
        return uoFromSums(
            slot.sumBpShort,
            slot.sumTrShort,
            slot.sumBpMedium,
            slot.sumTrMedium,
            slot.sumBpLong,
            slot.sumTrLong,
        );
    }
    // The head bar's bp/tr were computed against prevPrevClose (the
    // close two bars ago). Replaying the head with the tick uses the
    // same prevPrevClose baseline.
    const [tickBp, tickTr] = computeBpTr(high, low, close, slot.prevPrevClose);
    return uoFromSums(
        slot.sumBpShort - slot.headBpShort + tickBp,
        slot.sumTrShort - slot.headTrShort + tickTr,
        slot.sumBpMedium - slot.headBpMedium + tickBp,
        slot.sumTrMedium - slot.headTrMedium + tickTr,
        slot.sumBpLong - slot.headBpLong + tickBp,
        slot.sumTrLong - slot.headTrLong + tickTr,
    );
}

/**
 * Larry Williams' Ultimate Oscillator. Sources from `bar.high` /
 * `bar.low` / `bar.close` directly (no `source` arg — matches Pine).
 * Weighted average of three buying-pressure / true-range ratios over
 * `shortLength` / `mediumLength` / `longLength` windows (defaults
 * `7` / `14` / `28`). Output bounded `[0, 100]` (or `NaN`).
 *
 * Zero-TR window (flat-line input over the long window) emits `NaN`.
 * The registry records `yDomain: { kind: "fixed", min: 0, max: 100 }`
 * via `TA_REGISTRY_METADATA`.
 *
 * @formula  bp = close − min(low, prevClose) ;
 *           tr = max(high, prevClose) − min(low, prevClose) ;
 *           avgN = Σ bp[t − N + 1 .. t] / Σ tr[t − N + 1 .. t] ;
 *           uo = 100 · (4 · avgShort + 2 · avgMedium + avgLong) / 7
 * @warmup   longLength
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const u = ta.ultimateOsc("slot");
 *     // plot(u);
 */
export function ultimateOsc(slotId: string, opts?: UltimateOscOpts): Series<number> {
    const ctx = getCtx();
    const shortLength = opts?.shortLength ?? DEFAULT_SHORT_LENGTH;
    const mediumLength = opts?.mediumLength ?? DEFAULT_MEDIUM_LENGTH;
    const longLength = opts?.longLength ?? DEFAULT_LONG_LENGTH;
    let slot = ctx.stream.taSlots.get(slotId) as UltimateOscSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(shortLength, mediumLength, longLength, ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const bar = ctx.stream.bar;
    if (ctx.isTick) {
        slot.outBuffer.replaceHead(tickValue(slot, bar.high, bar.low, bar.close));
    } else {
        slot.outBuffer.append(closeValue(slot, bar.high, bar.low, bar.close));
    }
    return slot.series;
}
