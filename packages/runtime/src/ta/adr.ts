// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/adr.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. ADR derives from `bar.high`/`bar.low`/
// `bar.time` directly — no `source` argument per the absolute-range
// formula. The Phase-2 calendar-day boundary keys on UTC midnight
// (`floor(time / 86_400_000)`); Phase 4 lifts this onto
// `syminfo.session`.

import type { AdrOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView } from "../seriesView";

const DEFAULT_LENGTH = 14;
const MS_PER_DAY = 86_400_000;

type AdrSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly length: number;
    /**
     * Ring of the last `length` COMPLETED daily ranges
     * (`dailyHigh - dailyLow` per UTC calendar day). Capacity = `length`.
     */
    readonly completedRanges: Float64RingBuffer;
    /** Sum of the completed-range ring; refreshed on each commit. */
    sumRanges: number;
    /** Running daily high — folded across all bars sharing `currentDayKey`. */
    dailyHigh: number;
    /** Running daily low. */
    dailyLow: number;
    /**
     * UTC calendar-day key for the in-progress day, or `Number.NaN`
     * before the first bar with a finite time has been folded in.
     */
    currentDayKey: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.adr called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, capacity: number): AdrSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        length,
        completedRanges: new Float64RingBuffer(length),
        sumRanges: 0,
        dailyHigh: Number.NaN,
        dailyLow: Number.NaN,
        currentDayKey: Number.NaN,
    };
}

function commitDay(slot: AdrSlot): void {
    // Defensive: callers gate on `Number.isFinite(currentDayKey)` so by the
    // time we get here `dailyHigh` / `dailyLow` were set by a prior bar
    // with finite OHLC. Keep the early return as a safety net.
    /* c8 ignore next */
    if (!Number.isFinite(slot.dailyHigh) || !Number.isFinite(slot.dailyLow)) return;
    const range = slot.dailyHigh - slot.dailyLow;
    if (slot.completedRanges.length === slot.length) {
        // Evict the oldest range before append.
        slot.sumRanges -= slot.completedRanges.at(slot.length - 1);
    }
    slot.completedRanges.append(range);
    slot.sumRanges += range;
}

function emit(slot: AdrSlot): number {
    if (slot.completedRanges.length < slot.length) return Number.NaN;
    return slot.sumRanges / slot.length;
}

function closeStep(slot: AdrSlot, high: number, low: number, time: number): number {
    // NaN bars skipped from the daily aggregation per task spec §6.
    if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(time)) {
        return emit(slot);
    }
    const dayKey = Math.floor(time / MS_PER_DAY);
    if (Number.isNaN(slot.currentDayKey)) {
        slot.currentDayKey = dayKey;
        slot.dailyHigh = high;
        slot.dailyLow = low;
        return emit(slot);
    }
    if (dayKey !== slot.currentDayKey) {
        // Rollover: commit the prior in-progress day, then seed the new
        // day with the current bar's high/low.
        commitDay(slot);
        slot.currentDayKey = dayKey;
        slot.dailyHigh = high;
        slot.dailyLow = low;
        return emit(slot);
    }
    // Same day: extend the in-progress aggregate.
    if (high > slot.dailyHigh) slot.dailyHigh = high;
    if (low < slot.dailyLow) slot.dailyLow = low;
    return emit(slot);
}

/**
 * Average Daily Range — SMA of `high − low` across the trailing
 * `length` completed UTC calendar days. Default `length = 14` per
 * TradingView. Reads `bar.high` / `bar.low` / `bar.time` directly
 * (no `source` argument per the absolute-range formula).
 *
 * **Calendar-day boundary.** Phase 2 keys "daily" on the UTC midnight
 * boundary (`Math.floor(time / 86_400_000)`). Bars sharing a day key
 * are aggregated into a single `(dailyHigh, dailyLow)` pair; the day
 * range commits to the rolling SMA when the next bar's day key differs.
 * The in-progress (currently-aggregating) day is NEVER included in the
 * average. Phase 4 lifts this onto `syminfo.session` so symbols with
 * non-UTC sessions can override the convention.
 *
 * **Tick mode.** Ticks within the in-progress bar do NOT shift the day
 * boundary (per the runtime invariant that ticks happen inside the
 * current bar); the emitted value is the cached SMA of the already-
 * committed days. The next close re-folds the bar into the in-progress
 * day aggregate.
 *
 * **NaN.** Bars with non-finite `high` / `low` / `time` are skipped
 * (no aggregation, no commit); the output reflects only the previously
 * committed days.
 *
 * @formula  out[t] = mean( (dailyHigh − dailyLow) over the last `length`
 *           completed UTC days, in price units )
 * @warmup   length daily bars
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const r = ta.adr({ length: 14 });
 *     // plot(r);
 */
export function adr(slotId: string, opts?: AdrOpts): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as AdrSlot | undefined;
    if (slot === undefined) {
        const length = opts?.length ?? DEFAULT_LENGTH;
        slot = initSlot(length, ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const { high, low, time } = ctx.stream.bar;
    if (ctx.isTick) {
        // Tick replay does NOT touch the day aggregate or the rolling
        // sum — those are snapshots of the last close. The output is the
        // committed SMA (NaN until warm).
        slot.outBuffer.replaceHead(emit(slot));
    } else {
        slot.outBuffer.append(closeStep(slot, high, low, time));
    }
    return slot.series;
}
