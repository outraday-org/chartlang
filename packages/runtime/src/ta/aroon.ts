// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/aroon.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. Aroon reads `bar.high` / `bar.low` directly
// (mirrors Pine's `ta.aroon(length)` which has no source param) and
// scans the trailing `length + 1` window per close for the argmax /
// argmin (matches the invinite reference's `computeAroonSeries` loop).

import type { AroonOpts, AroonResult } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView } from "../seriesView";

type AroonSlot = {
    readonly outputs: AroonResult;
    readonly upBuffer: Float64RingBuffer;
    readonly downBuffer: Float64RingBuffer;
    readonly length: number;
    /**
     * Closed-bar `high`s across the trailing `length + 1` window.
     * `at(0)` is the most recent close; `at(length)` is the oldest.
     */
    readonly highWindow: Float64RingBuffer;
    /** Closed-bar `low`s across the trailing `length + 1` window. */
    readonly lowWindow: Float64RingBuffer;
    /** Number of CLOSED bars folded into the slot so far. */
    barCount: number;
    /**
     * Bars-since-high computed at the most recent close (0-based,
     * `0 ≤ value ≤ length`). Updated only on close-side advances.
     */
    lastHighIndex: number;
    /** Bars-since-low computed at the most recent close. */
    lastLowIndex: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.aroon called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, capacity: number): AroonSlot {
    const upBuffer = new Float64RingBuffer(capacity);
    const downBuffer = new Float64RingBuffer(capacity);
    return {
        outputs: Object.freeze({
            up: makeSeriesView<number>(upBuffer),
            down: makeSeriesView<number>(downBuffer),
        }),
        upBuffer,
        downBuffer,
        length,
        highWindow: new Float64RingBuffer(length + 1),
        lowWindow: new Float64RingBuffer(length + 1),
        barCount: 0,
        lastHighIndex: 0,
        lastLowIndex: 0,
    };
}

/**
 * Scan the `length + 1` window for the bars-since-high index. NaN
 * entries are skipped (cannot win argmax). Tie-break: smallest age
 * wins (the most-recent extreme — matches invinite's `>` comparison
 * and TradingView's convention). Returns `-1` if every entry in the
 * window is NaN.
 *
 * `headHigh` is the candidate value for age 0 — passed separately so
 * tick replay can substitute the tick's head value without mutating
 * the closed `highWindow`.
 */
function scanHighArgmax(window: Float64RingBuffer, headHigh: number, length: number): number {
    let bestIdx = -1;
    let bestVal = Number.NEGATIVE_INFINITY;
    if (Number.isFinite(headHigh)) {
        bestIdx = 0;
        bestVal = headHigh;
    }
    for (let k = 1; k <= length; k += 1) {
        const v = window.at(k);
        if (Number.isFinite(v) && v > bestVal) {
            bestVal = v;
            bestIdx = k;
        }
    }
    return bestIdx;
}

function scanLowArgmin(window: Float64RingBuffer, headLow: number, length: number): number {
    let bestIdx = -1;
    let bestVal = Number.POSITIVE_INFINITY;
    if (Number.isFinite(headLow)) {
        bestIdx = 0;
        bestVal = headLow;
    }
    for (let k = 1; k <= length; k += 1) {
        const v = window.at(k);
        if (Number.isFinite(v) && v < bestVal) {
            bestVal = v;
            bestIdx = k;
        }
    }
    return bestIdx;
}

function closeStep(slot: AroonSlot, high: number, low: number): { up: number; down: number } {
    slot.barCount += 1;
    slot.highWindow.append(high);
    slot.lowWindow.append(low);

    // Per the invinite reference: warmup is `length` bars; the first
    // finite output lands at `barCount === length + 1` (the bar at
    // 0-based index `length`).
    if (slot.barCount <= slot.length) {
        return { up: Number.NaN, down: Number.NaN };
    }

    const barsSinceHigh = scanHighArgmax(slot.highWindow, slot.highWindow.at(0), slot.length);
    const barsSinceLow = scanLowArgmin(slot.lowWindow, slot.lowWindow.at(0), slot.length);
    if (barsSinceHigh === -1 || barsSinceLow === -1) {
        return { up: Number.NaN, down: Number.NaN };
    }
    slot.lastHighIndex = barsSinceHigh;
    slot.lastLowIndex = barsSinceLow;
    const up = (100 * (slot.length - barsSinceHigh)) / slot.length;
    const down = (100 * (slot.length - barsSinceLow)) / slot.length;
    return { up, down };
}

function tickStep(slot: AroonSlot, high: number, low: number): { up: number; down: number } {
    if (slot.barCount <= slot.length) return { up: Number.NaN, down: Number.NaN };
    // Substitute the tick's head values into the scan without mutating
    // the closed window. The age-0 slot in `highWindow` / `lowWindow`
    // still holds the most recent CLOSE; we pass `high` / `low` as the
    // override.
    const barsSinceHigh = scanHighArgmax(slot.highWindow, high, slot.length);
    const barsSinceLow = scanLowArgmin(slot.lowWindow, low, slot.length);
    if (barsSinceHigh === -1 || barsSinceLow === -1) {
        return { up: Number.NaN, down: Number.NaN };
    }
    const up = (100 * (slot.length - barsSinceHigh)) / slot.length;
    const down = (100 * (slot.length - barsSinceLow)) / slot.length;
    return { up, down };
}

/**
 * Aroon — recency-of-extreme oscillator over the trailing `length + 1`
 * bars. `aroon.up` tracks how recently a new N-bar high was made;
 * `aroon.down` mirrors with N-bar lows. Both Series ∈ [0, 100] when
 * defined; NaN until `length` closed bars have been folded in. Reads
 * `bar.high` / `bar.low` directly from the runtime stream (mirrors
 * Pine's `ta.aroon(length)` — no source param). Returns a cached
 * `{ up, down }` record (same identity every bar).
 *
 * @formula  barsSinceHigh = age (0..length) of the max high in window ;
 *           barsSinceLow  = age (0..length) of the min low in window ;
 *           up   = 100 · (length − barsSinceHigh) / length ;
 *           down = 100 · (length − barsSinceLow)  / length
 * @warmup   length
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const a = ta.aroon(14);
 *     // plot(a.up);
 *     // plot(a.down);
 */
export function aroon(slotId: string, length: number, _opts?: AroonOpts): AroonResult {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as AroonSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(length, ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const high = ctx.stream.bar.high;
    const low = ctx.stream.bar.low;
    if (ctx.isTick) {
        const { up, down } = tickStep(slot, high, low);
        slot.upBuffer.replaceHead(up);
        slot.downBuffer.replaceHead(down);
    } else {
        const { up, down } = closeStep(slot, high, low);
        slot.upBuffer.append(up);
        slot.downBuffer.append(down);
    }
    return slot.outputs;
}
