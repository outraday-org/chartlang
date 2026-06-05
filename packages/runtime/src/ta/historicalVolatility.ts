// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/historical-volatility.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. The rolling log-returns window is folded
// incrementally per bar (one append per close, one head-replace per
// tick) rather than invinite's full-array recompute. The Phase-1
// `lib/rollingStddev` helper is the full-recompute reference the
// property test asserts against.

import type { HvOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView, makeShiftedSeriesView } from "../seriesView";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue";

const DEFAULT_ANNUALISATION_FACTOR = 365;

type HvSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly length: number;
    readonly annualisationFactor: number;
    readonly logReturnsWindow: Float64RingBuffer;
    sumX: number;
    sumX2: number;
    /** Last closed source value (basis of next bar's log-return). */
    prevSrc: number;
    /** Per-offset Series-view cache; see `sma.ts` for the convention. */
    readonly shiftedViews: Map<number, Series<number>>;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.historicalVolatility called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, annualisationFactor: number, capacity: number): HvSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        length,
        annualisationFactor,
        logReturnsWindow: new Float64RingBuffer(length),
        sumX: 0,
        sumX2: 0,
        prevSrc: Number.NaN,
        shiftedViews: new Map(),
    };
}

function viewForOffset(slot: HvSlot, offset: number): Series<number> {
    if (offset === 0) return slot.series;
    let view = slot.shiftedViews.get(offset);
    if (view === undefined) {
        view = makeShiftedSeriesView<number>(slot.outBuffer, offset);
        slot.shiftedViews.set(offset, view);
    }
    return view;
}

function logReturn(prev: number, cur: number): number {
    if (!Number.isFinite(prev) || !Number.isFinite(cur) || prev <= 0 || cur <= 0) {
        return Number.NaN;
    }
    return Math.log(cur / prev);
}

function windowStdDev(window: Float64RingBuffer, sumX: number, sumX2: number): number {
    const n = window.length;
    // Defensive: callers gate on `length === capacity` so n > 0 here.
    /* c8 ignore next */
    if (n <= 0) return Number.NaN;
    const mean = sumX / n;
    const variance = sumX2 / n - mean * mean;
    return Math.sqrt(Math.max(0, variance));
}

/**
 * Recompute the window-sums by walking the buffer. Called when a NaN
 * has been folded into the running sums (which would otherwise poison
 * every subsequent recompute) — restores the running invariant from
 * the live window contents. O(length) but only runs when needed.
 */
function recomputeSums(slot: HvSlot): void {
    let sumX = 0;
    let sumX2 = 0;
    let anyNaN = false;
    for (let i = 0; i < slot.logReturnsWindow.length; i += 1) {
        const v = slot.logReturnsWindow.at(slot.logReturnsWindow.length - 1 - i);
        if (!Number.isFinite(v)) {
            anyNaN = true;
            break;
        }
        sumX += v;
        sumX2 += v * v;
    }
    if (anyNaN) {
        slot.sumX = Number.NaN;
        slot.sumX2 = Number.NaN;
    } else {
        slot.sumX = sumX;
        slot.sumX2 = sumX2;
    }
}

function closeValue(slot: HvSlot, src: number): number {
    const lr = logReturn(slot.prevSrc, src);
    if (slot.logReturnsWindow.length < slot.logReturnsWindow.capacity) {
        slot.logReturnsWindow.append(lr);
        if (Number.isFinite(lr)) {
            slot.sumX += lr;
            slot.sumX2 += lr * lr;
        } else {
            slot.sumX = Number.NaN;
            slot.sumX2 = Number.NaN;
        }
        slot.prevSrc = src;
        return Number.NaN;
    }
    const outgoing = slot.logReturnsWindow.at(slot.logReturnsWindow.length - 1);
    slot.logReturnsWindow.append(lr);
    if (!Number.isFinite(lr)) {
        slot.sumX = Number.NaN;
        slot.sumX2 = Number.NaN;
    } else if (
        !Number.isFinite(slot.sumX) ||
        /* c8 ignore next */
        !Number.isFinite(outgoing)
    ) {
        // A previous NaN poisoned the running sums; rebuild from the
        // live window. NaN inside short-circuits to NaN. The
        // `!Number.isFinite(outgoing)` half of the OR is defensive —
        // outgoing comes from the live window head and is only NaN
        // when a NaN was previously appended, which also poisoned
        // `sumX` (covered by the first half of the OR).
        recomputeSums(slot);
    } else {
        slot.sumX = slot.sumX - outgoing + lr;
        slot.sumX2 = slot.sumX2 - outgoing * outgoing + lr * lr;
    }
    slot.prevSrc = src;
    if (!Number.isFinite(slot.sumX)) return Number.NaN;
    const sd = windowStdDev(slot.logReturnsWindow, slot.sumX, slot.sumX2);
    return sd * Math.sqrt(slot.annualisationFactor) * 100;
}

function tickValue(slot: HvSlot, src: number): number {
    if (slot.logReturnsWindow.length < slot.logReturnsWindow.capacity) return Number.NaN;
    const lr = logReturn(slot.prevSrc, src);
    if (!Number.isFinite(lr) || !Number.isFinite(slot.sumX)) return Number.NaN;
    const oldestInHead = slot.logReturnsWindow.at(0);
    // Defensive: the close-side advance appends a finite lr (otherwise
    // sumX is poisoned and we returned at the guard above). The window
    // head can only be NaN if a prior NaN was appended, which is
    // already covered by the sumX guard.
    /* c8 ignore next */
    if (!Number.isFinite(oldestInHead)) return Number.NaN;
    const sumX = slot.sumX - oldestInHead + lr;
    const sumX2 = slot.sumX2 - oldestInHead * oldestInHead + lr * lr;
    const n = slot.logReturnsWindow.length;
    const mean = sumX / n;
    const variance = sumX2 / n - mean * mean;
    return Math.sqrt(Math.max(0, variance)) * Math.sqrt(slot.annualisationFactor) * 100;
}

/**
 * Historical Volatility — sub-pane line. Standard deviation of log
 * returns annualised + percent-scaled. Use `annualisationFactor: 365`
 * for crypto / 24-7 series (the default), `252` for trading-day
 * equity series. NaN through warmup (`[0, length − 1]`) — the first
 * log return lands at bar 1 and the window needs `length` of them.
 * NaN inputs (≤ 0 or non-finite source) yield NaN log-returns; any
 * NaN inside the window short-circuits the output to NaN.
 *
 * @formula  lr[t]  = ln(src[t] / src[t − 1]) ;
 *           hv[t]  = stddev(lr[t − length + 1..= t]) · sqrt(annualisationFactor) · 100
 * @warmup   length
 * @anchors  annualisationFactor
 * @since 0.2
 * @experimental
 *
 * `opts.offset` shifts the returned series so `series.current` reads
 * the value `offset` bars ago (PLAN.md §9.1).
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const hv = ta.historicalVolatility(bar.close, 10);
 *     // plot(hv);
 */
export function historicalVolatility(
    slotId: string,
    source: ScalarOrSeries,
    length: number,
    opts?: HvOpts,
): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as HvSlot | undefined;
    if (slot === undefined) {
        const annualisationFactor = opts?.annualisationFactor ?? DEFAULT_ANNUALISATION_FACTOR;
        slot = initSlot(length, annualisationFactor, ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const src = readSourceValue(source);
    if (ctx.isTick) {
        slot.outBuffer.replaceHead(tickValue(slot, src));
    } else {
        slot.outBuffer.append(closeValue(slot, src));
    }
    return viewForOffset(slot, opts?.offset ?? 0);
}
