// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/connors-rsi.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape. Composition: Phase-1
// `ta.rsi` on the raw source (sub-slot `${slotId}/rsi`) + a second
// `ta.rsi` on the signed-streak scalar (sub-slot
// `${slotId}/streakRsi`) — no private RSI math duplication. The
// signed-streak helper + the rolling percent-rank live inline in this
// file per task spec §3 ("not factored to lib until a second consumer
// appears").
//
// DEVIATION from invinite: invinite's reference requires all three
// components (RSI, streak-RSI, percent-rank) finite for the CRSI line
// to be defined; on any NaN it propagates. The task spec §6 overrides
// to "sub-component NaN → component skipped in the average". We follow
// the spec — fully-NaN inputs still emit NaN, but a partially-warm
// state yields a partial average. This is a tighter alignment with
// the Pine `ta.connorsRsi` semantic where streak-RSI warmup doesn't
// gate the rsi-on-close component.

import type { ConnorsRsiOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView, makeShiftedSeriesView } from "../seriesView.js";
import { rsi } from "./rsi.js";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue.js";

const DEFAULT_RSI_LENGTH = 3;
const DEFAULT_STREAK_LENGTH = 2;
const DEFAULT_ROC_LENGTH = 100;

type ConnorsRsiSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly rsiLength: number;
    readonly streakLength: number;
    readonly rocLength: number;
    /** Streak state at head (tick-aware). */
    streakSign: 1 | -1 | 0;
    streakRun: number;
    /** Snapshot at last close (used for tick replay). */
    prevClosedStreakSign: 1 | -1 | 0;
    prevClosedStreakRun: number;
    /** Source value at last close (used for streak diff on next close). */
    prevClosedSrc: number;
    /** Per-bar ROC(1) values (signed pct). Head `at(0)` is the current bar's ROC. */
    readonly rocWindow: Float64RingBuffer;
    /** Number of closed bars folded. */
    barCount: number;
    /** Per-offset Series-view cache. */
    readonly shiftedViews: Map<number, Series<number>>;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.connorsRsi called outside an active script step");
    }
    return ctx;
}

function initSlot(
    rsiLength: number,
    streakLength: number,
    rocLength: number,
    capacity: number,
): ConnorsRsiSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        rsiLength,
        streakLength,
        rocLength,
        streakSign: 0,
        streakRun: 0,
        prevClosedStreakSign: 0,
        prevClosedStreakRun: 0,
        prevClosedSrc: Number.NaN,
        // rocWindow capacity = rocLength + 1: room for the current
        // bar's ROC at `at(0)` plus the trailing `rocLength` values
        // we percent-rank against.
        rocWindow: new Float64RingBuffer(rocLength + 1),
        barCount: 0,
        shiftedViews: new Map(),
    };
}

function viewForOffset(slot: ConnorsRsiSlot, offset: number): Series<number> {
    if (offset === 0) return slot.series;
    let view = slot.shiftedViews.get(offset);
    if (view === undefined) {
        view = makeShiftedSeriesView<number>(slot.outBuffer, offset);
        slot.shiftedViews.set(offset, view);
    }
    return view;
}

function stepStreak(
    prevSign: 1 | -1 | 0,
    prevRun: number,
    diff: number,
): { sign: 1 | -1 | 0; run: number } {
    if (!Number.isFinite(diff) || diff === 0) {
        return { sign: 0, run: 0 };
    }
    if (diff > 0) {
        return { sign: 1, run: prevSign === 1 ? prevRun + 1 : 1 };
    }
    return { sign: -1, run: prevSign === -1 ? prevRun + 1 : 1 };
}

function streakScalar(sign: 1 | -1 | 0, run: number): number {
    if (sign === 0) return 0;
    return sign * run;
}

function pctChange(curr: number, prev: number): number {
    if (!Number.isFinite(curr) || !Number.isFinite(prev) || prev === 0) return Number.NaN;
    return (100 * (curr - prev)) / prev;
}

/**
 * Rolling percent rank of the head ROC value (`rocWindow.at(0)`)
 * within the trailing `rocLength` ROC values (exclusive of the head).
 * Returns 50 on an empty window (matches invinite). NaN target → NaN.
 */
function percentRankHead(slot: ConnorsRsiSlot): number {
    const target = slot.rocWindow.at(0);
    if (!Number.isFinite(target)) return Number.NaN;
    const windowSize = slot.rocWindow.length - 1;
    // Defensive: percentRankHead is only called after the ROC window has
    // at least two entries (post-warmup), so windowSize >= 1 here.
    /* c8 ignore next */
    if (windowSize <= 0) return 50;
    const upper = Math.min(windowSize, slot.rocLength);
    let countBelow = 0;
    let validCount = 0;
    for (let j = 1; j <= upper; j += 1) {
        const v = slot.rocWindow.at(j);
        if (!Number.isFinite(v)) continue;
        validCount += 1;
        if (v < target) countBelow += 1;
    }
    return validCount === 0 ? 50 : (100 * countBelow) / validCount;
}

function blendCrsi(rsiHead: number, streakRsiHead: number, pctRank: number): number {
    let sum = 0;
    let count = 0;
    if (Number.isFinite(rsiHead)) {
        sum += rsiHead;
        count += 1;
    }
    if (Number.isFinite(streakRsiHead)) {
        sum += streakRsiHead;
        count += 1;
    }
    if (Number.isFinite(pctRank)) {
        sum += pctRank;
        count += 1;
    }
    return count === 0 ? Number.NaN : sum / count;
}

/**
 * Connors RSI — three-component blend of `RSI(source, rsiLength)`,
 * `RSI(streak, streakLength)`, and `PercentRank(ROC(source, 1),
 * rocLength)` averaged into a single line bounded `[0, 100]`. The
 * registry records `yDomain: { kind: "fixed", min: 0, max: 100 }` in
 * `TA_REGISTRY_METADATA`. Composes Phase-1 `ta.rsi` for both RSI
 * components (no private RSI math). Defaults `(3, 2, 100)` matches
 * Larry Connors' original spec.
 *
 * @formula  diff       = source[t] − source[t − 1] ;
 *           streak[t]  = signed run-length of consecutive same-sign diffs ;
 *           rsiClose   = rsi(source, rsiLength) ;
 *           rsiStreak  = rsi(streak, streakLength) ;
 *           roc1       = 100 · diff / source[t − 1] ;
 *           pctRank    = 100 · #(roc1[i] < roc1[t]) / validWindowCount
 *                        over i in [t − rocLength, t − 1] ;
 *           crsi       = (rsiClose + rsiStreak + pctRank) / 3 ;
 *           components that are NaN are skipped — count adjusts
 * @warmup   max(rsiLength, streakLength, rocLength) + 1
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const c = ta.connorsRsi("slot", bar.close);
 *     // plot(c);
 */
export function connorsRsi(
    slotId: string,
    source: ScalarOrSeries,
    opts?: ConnorsRsiOpts,
): Series<number> {
    const ctx = getCtx();
    const rsiLength = opts?.rsiLength ?? DEFAULT_RSI_LENGTH;
    const streakLength = opts?.streakLength ?? DEFAULT_STREAK_LENGTH;
    const rocLength = opts?.rocLength ?? DEFAULT_ROC_LENGTH;
    let slot = ctx.stream.taSlots.get(slotId) as ConnorsRsiSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(rsiLength, streakLength, rocLength, ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const src = readSourceValue(source);

    if (ctx.isTick) {
        // Tick replay: use the SNAPSHOT (prevClosed*) state — do NOT
        // mutate `streakSign` / `streakRun` / `prevClosedSrc` /
        // `barCount` / advance rocWindow.
        const diff = pctChange(src, slot.prevClosedSrc);
        const { sign, run } = stepStreak(
            slot.prevClosedStreakSign,
            slot.prevClosedStreakRun,
            /* c8 ignore next */
            Number.isFinite(slot.prevClosedSrc) ? src - slot.prevClosedSrc : Number.NaN,
        );
        const roc = diff;
        slot.rocWindow.replaceHead(roc);
        const rsiHead = rsi(`${slotId}/rsi`, src, rsiLength).current;
        const streakRsiHead = rsi(
            `${slotId}/streakRsi`,
            streakScalar(sign, run),
            streakLength,
        ).current;
        const pr = percentRankHead(slot);
        slot.outBuffer.replaceHead(blendCrsi(rsiHead, streakRsiHead, pr));
    } else {
        const diff = Number.isFinite(slot.prevClosedSrc) ? src - slot.prevClosedSrc : Number.NaN;
        const { sign, run } = stepStreak(slot.streakSign, slot.streakRun, diff);
        const roc = pctChange(src, slot.prevClosedSrc);
        slot.rocWindow.append(roc);
        const rsiHead = rsi(`${slotId}/rsi`, src, rsiLength).current;
        const streakRsiHead = rsi(
            `${slotId}/streakRsi`,
            streakScalar(sign, run),
            streakLength,
        ).current;
        const pr = percentRankHead(slot);
        slot.outBuffer.append(blendCrsi(rsiHead, streakRsiHead, pr));
        // Advance close-side state.
        slot.prevClosedStreakSign = slot.streakSign;
        slot.prevClosedStreakRun = slot.streakRun;
        slot.streakSign = sign;
        slot.streakRun = run;
        slot.prevClosedSrc = src;
        slot.barCount += 1;
    }
    return viewForOffset(slot, opts?.offset ?? 0);
}
