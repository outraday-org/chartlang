// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/vortex.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. Vortex reads `bar.high` / `bar.low` /
// `bar.close` directly (mirrors Pine's `ta.vortex(length)` — no source
// param) and maintains rolling running-sum windows over `vmPlus`,
// `vmMinus`, and TR for O(1) per-bar updates. NaN-on-zero-TR semantics
// per chartlang task spec §6 (invinite emits 0 on zero TR; chartlang
// emits NaN to surface the degenerate window).

import type { VortexOpts, VortexResult } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView, makeShiftedSeriesView } from "../seriesView.js";

type VortexSlot = {
    readonly result: VortexResult;
    readonly plusBuffer: Float64RingBuffer;
    readonly minusBuffer: Float64RingBuffer;
    readonly length: number;
    readonly vmPlusWindow: Float64RingBuffer;
    readonly vmMinusWindow: Float64RingBuffer;
    readonly trWindow: Float64RingBuffer;
    runningPlus: number;
    runningMinus: number;
    runningTr: number;
    prevHigh: number;
    prevLow: number;
    prevClose: number;
    /** Snapshots captured at the prior close so tick replay can read
     * against the bar-before-current. */
    prevPrevHigh: number;
    prevPrevLow: number;
    prevPrevClose: number;
    /** Running sums AS OF THE PRIOR CLOSE — used by tick replay to
     * substitute the tick's contribution. */
    prevClosedRunningPlus: number;
    prevClosedRunningMinus: number;
    prevClosedRunningTr: number;
    /** Tail values evicted on the current close (the
     * `length`-bars-ago slot at the moment the current close advanced
     * the window). Used by tick replay to recompute the running sum
     * with the tick's substituted contribution. */
    evictedPlus: number;
    evictedMinus: number;
    evictedTr: number;
    /** Number of CLOSED bars folded into the slot so far. */
    barCount: number;
    readonly shiftedResults: Map<number, VortexResult>;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.vortex called outside an active script step");
    }
    return ctx;
}

function trueRange(high: number, low: number, prevClose: number): number {
    if (!Number.isFinite(prevClose)) return high - low;
    return Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
}

function initSlot(length: number, capacity: number): VortexSlot {
    const plusBuffer = new Float64RingBuffer(capacity);
    const minusBuffer = new Float64RingBuffer(capacity);
    return {
        result: Object.freeze({
            plus: makeSeriesView<number>(plusBuffer),
            minus: makeSeriesView<number>(minusBuffer),
        }),
        plusBuffer,
        minusBuffer,
        length,
        vmPlusWindow: new Float64RingBuffer(length),
        vmMinusWindow: new Float64RingBuffer(length),
        trWindow: new Float64RingBuffer(length),
        runningPlus: 0,
        runningMinus: 0,
        runningTr: 0,
        prevHigh: Number.NaN,
        prevLow: Number.NaN,
        prevClose: Number.NaN,
        prevPrevHigh: Number.NaN,
        prevPrevLow: Number.NaN,
        prevPrevClose: Number.NaN,
        prevClosedRunningPlus: 0,
        prevClosedRunningMinus: 0,
        prevClosedRunningTr: 0,
        evictedPlus: 0,
        evictedMinus: 0,
        evictedTr: 0,
        barCount: 0,
        shiftedResults: new Map(),
    };
}

function resultForOffset(slot: VortexSlot, offset: number): VortexResult {
    if (offset === 0) return slot.result;
    let cached = slot.shiftedResults.get(offset);
    if (cached === undefined) {
        cached = Object.freeze({
            plus: makeShiftedSeriesView<number>(slot.plusBuffer, offset),
            minus: makeShiftedSeriesView<number>(slot.minusBuffer, offset),
        });
        slot.shiftedResults.set(offset, cached);
    }
    return cached;
}

function divide(num: number, den: number): number {
    // chartlang task spec §6: zero-TR window → NaN (degenerate; invinite
    // emits 0). Surface as NaN so script-author conditionals can branch.
    if (den === 0 || !Number.isFinite(den) || !Number.isFinite(num)) return Number.NaN;
    return num / den;
}

function closeStep(
    slot: VortexSlot,
    high: number,
    low: number,
    close: number,
): { plus: number; minus: number } {
    if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
        // Hold state forward; emit NaN.
        return { plus: Number.NaN, minus: Number.NaN };
    }

    slot.barCount += 1;

    // Snapshot prior running sums (post-prior-close state — these are
    // the values tick replay needs to re-derive the head against the
    // PRIOR closed bar).
    slot.prevClosedRunningPlus = slot.runningPlus;
    slot.prevClosedRunningMinus = slot.runningMinus;
    slot.prevClosedRunningTr = slot.runningTr;

    const tr = trueRange(high, low, slot.prevClose);
    const vmPlus = Number.isFinite(slot.prevLow) ? Math.abs(high - slot.prevLow) : 0;
    const vmMinus = Number.isFinite(slot.prevHigh) ? Math.abs(low - slot.prevHigh) : 0;

    // Capture prev-prev BEFORE overwriting prev (tick replay reads
    // against the bar-before-current).
    slot.prevPrevHigh = slot.prevHigh;
    slot.prevPrevLow = slot.prevLow;
    slot.prevPrevClose = slot.prevClose;
    slot.prevHigh = high;
    slot.prevLow = low;
    slot.prevClose = close;

    // Roll the windows; capture evicted tail values for tick replay.
    if (slot.vmPlusWindow.length >= slot.length) {
        slot.evictedPlus = slot.vmPlusWindow.at(slot.length - 1);
        slot.evictedMinus = slot.vmMinusWindow.at(slot.length - 1);
        slot.evictedTr = slot.trWindow.at(slot.length - 1);
        slot.runningPlus -= slot.evictedPlus;
        slot.runningMinus -= slot.evictedMinus;
        slot.runningTr -= slot.evictedTr;
    } else {
        slot.evictedPlus = 0;
        slot.evictedMinus = 0;
        slot.evictedTr = 0;
    }
    slot.vmPlusWindow.append(vmPlus);
    slot.vmMinusWindow.append(vmMinus);
    slot.trWindow.append(tr);
    slot.runningPlus += vmPlus;
    slot.runningMinus += vmMinus;
    slot.runningTr += tr;

    // Warmup: first defined output at `barCount === length + 1` (i.e.
    // bar index `length` zero-based). The seed window completes when
    // the `length`-th VM/TR triple has been folded in.
    if (slot.barCount <= slot.length) {
        return { plus: Number.NaN, minus: Number.NaN };
    }
    return {
        plus: divide(slot.runningPlus, slot.runningTr),
        minus: divide(slot.runningMinus, slot.runningTr),
    };
}

function tickStep(
    slot: VortexSlot,
    high: number,
    low: number,
    close: number,
): { plus: number; minus: number } {
    if (slot.barCount <= slot.length) return { plus: Number.NaN, minus: Number.NaN };
    if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
        return { plus: Number.NaN, minus: Number.NaN };
    }
    // Tick replay against the BAR BEFORE the current bar.
    const tr = trueRange(high, low, slot.prevPrevClose);
    // Defensive: `prevPrev*` is seeded by the prior close-side advance,
    // so by the time `barCount > length` (the guard above) these are
    // finite. The `: 0` fallback is defence-in-depth.
    /* c8 ignore next 2 */
    const vmPlus = Number.isFinite(slot.prevPrevLow) ? Math.abs(high - slot.prevPrevLow) : 0;
    const vmMinus = Number.isFinite(slot.prevPrevHigh) ? Math.abs(low - slot.prevPrevHigh) : 0;
    // Re-derive the running sums by starting from the prior closed
    // sums, subtracting the head bar's evicted tail (captured at the
    // close-side advance), and adding the tick's contribution.
    const runningPlus = slot.prevClosedRunningPlus - slot.evictedPlus + vmPlus;
    const runningMinus = slot.prevClosedRunningMinus - slot.evictedMinus + vmMinus;
    const runningTr = slot.prevClosedRunningTr - slot.evictedTr + tr;
    return {
        plus: divide(runningPlus, runningTr),
        minus: divide(runningMinus, runningTr),
    };
}

/**
 * Vortex Indicator (Botes & Siepman, 2010) — paired `+VI` / `−VI`
 * trend-direction lines. Reads `bar.high` / `bar.low` / `bar.close`
 * directly (mirrors Pine's `ta.vortex(length)` — no source param).
 * Maintains rolling running-sum windows over the per-bar `vmPlus`,
 * `vmMinus`, and TR series for O(1) per-bar updates. Returns a cached
 * `{ plus, minus }` record (same identity every bar).
 *
 * @formula  TR[t]      = max(high − low, |high − prevClose|, |low − prevClose|) ;
 *           vmPlus[t]  = |high[t] − low[t-1]| ;
 *           vmMinus[t] = |low[t]  − high[t-1]| ;
 *           plus[t]    = Σ(vmPlus, length)  / Σ(TR, length) ;
 *           minus[t]   = Σ(vmMinus, length) / Σ(TR, length) ;
 *           NaN when Σ(TR, length) === 0 (degenerate flat window).
 * @warmup   length
 * @since 0.2
 * @stable
 *
 * `opts.offset` shifts both series in lockstep (PLAN.md §9.1) —
 * `series.current` on each output returns the value `offset` bars ago.
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const v = ta.vortex("slot", 14);
 *     // plot(v.plus);
 *     // plot(v.minus);
 */
export function vortex(slotId: string, length: number, opts?: VortexOpts): VortexResult {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as VortexSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(length, ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const bar = ctx.stream.bar;
    if (ctx.isTick) {
        const { plus, minus } = tickStep(slot, bar.high, bar.low, bar.close);
        slot.plusBuffer.replaceHead(plus);
        slot.minusBuffer.replaceHead(minus);
    } else {
        const { plus, minus } = closeStep(slot, bar.high, bar.low, bar.close);
        slot.plusBuffer.append(plus);
        slot.minusBuffer.append(minus);
    }
    return resultForOffset(slot, opts?.offset ?? 0);
}
