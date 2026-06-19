// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/mass-index.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. The chained EMA-of-range and EMA-of-EMA
// arms compose `ta.ema` via sub-slots `${slotId}/ema1` /
// `${slotId}/ema2` so the EMA recurrence + warmup semantics flow in
// by reference. The rolling-sum-of-ratio window is folded
// incrementally per bar.

import type { MassIndexOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView, makeShiftedSeriesView } from "../seriesView.js";
import { ema } from "./ema.js";

const DEFAULT_EMA_LENGTH = 9;
const DEFAULT_SUM_LENGTH = 25;

type MassIndexSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly emaLength: number;
    readonly sumLength: number;
    readonly ratioWindow: Float64RingBuffer;
    sumRatio: number;
    /** Per-offset Series-view cache; see `sma.ts` for the convention. */
    readonly shiftedViews: Map<number, Series<number>>;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.massIndex called outside an active script step");
    }
    return ctx;
}

function initSlot(emaLength: number, sumLength: number, capacity: number): MassIndexSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        emaLength,
        sumLength,
        ratioWindow: new Float64RingBuffer(sumLength),
        sumRatio: 0,
        shiftedViews: new Map(),
    };
}

function viewForOffset(slot: MassIndexSlot, offset: number): Series<number> {
    if (offset === 0) return slot.series;
    let view = slot.shiftedViews.get(offset);
    if (view === undefined) {
        view = makeShiftedSeriesView<number>(slot.outBuffer, offset);
        slot.shiftedViews.set(offset, view);
    }
    return view;
}

function ratioValue(e1: number, e2: number): number {
    if (!Number.isFinite(e1) || !Number.isFinite(e2) || e2 === 0) return Number.NaN;
    return e1 / e2;
}

function recomputeSum(slot: MassIndexSlot): void {
    let sum = 0;
    let anyNaN = false;
    for (let i = 0; i < slot.ratioWindow.length; i += 1) {
        const v = slot.ratioWindow.at(i);
        if (!Number.isFinite(v)) {
            anyNaN = true;
            break;
        }
        sum += v;
    }
    slot.sumRatio = anyNaN ? Number.NaN : sum;
}

function closeValue(slot: MassIndexSlot, ratio: number): number {
    if (slot.ratioWindow.length < slot.ratioWindow.capacity) {
        slot.ratioWindow.append(ratio);
        if (Number.isFinite(ratio)) {
            slot.sumRatio += ratio;
        } else {
            slot.sumRatio = Number.NaN;
        }
        if (slot.ratioWindow.length < slot.ratioWindow.capacity) return Number.NaN;
        return slot.sumRatio;
    }
    const outgoing = slot.ratioWindow.at(slot.ratioWindow.length - 1);
    slot.ratioWindow.append(ratio);
    if (Number.isFinite(outgoing) && Number.isFinite(ratio) && Number.isFinite(slot.sumRatio)) {
        slot.sumRatio = slot.sumRatio - outgoing + ratio;
    } else {
        recomputeSum(slot);
    }
    return slot.sumRatio;
}

function tickValue(slot: MassIndexSlot, ratio: number): number {
    if (slot.ratioWindow.length < slot.ratioWindow.capacity) return Number.NaN;
    const oldestInHead = slot.ratioWindow.at(0);
    // NaN propagates through subtraction/addition — Infinity does too —
    // so a poisoned sum, NaN ratio, or NaN oldestInHead all surface as
    // a non-finite value at the head.
    return slot.sumRatio - oldestInHead + ratio;
}

/**
 * Mass Index — sub-pane volatility line tracking the range-EMA
 * "bulge" ratio to flag trend-reversal setups via the canonical
 * 27 threshold. Built on EMA-of-EMA-of-range via two chained
 * sub-slots (`${slotId}/ema1`, `${slotId}/ema2`) — a fix to EMA's
 * recurrence flows in for free. Reads `bar.high − bar.low` directly
 * (no source param). NaN when either chained EMA is NaN or when
 * the inner EMA of EMA is zero (degenerate ratio).
 *
 * @formula  range[t] = high[t] − low[t] ;
 *           ema1     = EMA(emaLength)(range) ;
 *           ema2     = EMA(emaLength)(ema1) ;
 *           ratio[t] = ema1[t] / ema2[t] ;
 *           mi[t]    = sum(ratio[t − sumLength + 1..= t])
 * @warmup   emaLength + emaLength + sumLength − 3
 * @since 0.2
 * @stable
 *
 * `opts.offset` is a presentation display shift carried to the plot
 * emission as `xShift` (`+n` right / future, `−n` left / past); the
 * series value is unshifted.
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const mi = ta.massIndex();
 *     // plot(mi);
 */
export function massIndex(slotId: string, opts?: MassIndexOpts): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as MassIndexSlot | undefined;
    if (slot === undefined) {
        const emaLength = opts?.emaLength ?? DEFAULT_EMA_LENGTH;
        const sumLength = opts?.sumLength ?? DEFAULT_SUM_LENGTH;
        slot = initSlot(emaLength, sumLength, ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const range = ctx.stream.bar.high - ctx.stream.bar.low;
    const ema1Series = ema(`${slotId}/ema1`, range, slot.emaLength);
    const e1 = ema1Series.current;
    const ema2Series = ema(`${slotId}/ema2`, e1, slot.emaLength);
    const e2 = ema2Series.current;
    const ratio = ratioValue(e1, e2);
    if (ctx.isTick) {
        slot.outBuffer.replaceHead(tickValue(slot, ratio));
    } else {
        slot.outBuffer.append(closeValue(slot, ratio));
    }
    return viewForOffset(slot, opts?.offset ?? 0);
}
