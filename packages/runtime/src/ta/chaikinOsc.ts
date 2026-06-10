// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/chaikin-osc.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. Per §9.4 we fold invinite's private ADL +
// EMA copies onto the canonical `ta.adl` + `ta.ema` primitives via
// three sub-slots (`${slotId}/adl`, `${slotId}/fast`, `${slotId}/slow`).

import type { ChaikinOscOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView, makeShiftedSeriesView } from "../seriesView.js";
import { adl } from "./adl.js";
import { ema } from "./ema.js";

const DEFAULT_FAST = 3;
const DEFAULT_SLOW = 10;

type ChaikinOscSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly shiftedViews: Map<number, Series<number>>;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.chaikinOsc called outside an active script step");
    }
    return ctx;
}

function initSlot(capacity: number): ChaikinOscSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        shiftedViews: new Map(),
    };
}

function viewForOffset(slot: ChaikinOscSlot, offset: number): Series<number> {
    if (offset === 0) return slot.series;
    let view = slot.shiftedViews.get(offset);
    if (view === undefined) {
        view = makeShiftedSeriesView<number>(slot.outBuffer, offset);
        slot.shiftedViews.set(offset, view);
    }
    return view;
}

function diff(fast: number, slow: number): number {
    if (!Number.isFinite(fast) || !Number.isFinite(slow)) return Number.NaN;
    return fast - slow;
}

/**
 * Chaikin Oscillator — `EMA(ADL, fastLength) − EMA(ADL, slowLength)`.
 * Composes one `ta.adl` sub-slot (cumulative money-flow volume) plus
 * two `ta.ema` sub-slots over the ADL series; a fix to `ta.adl` or
 * `ta.ema` flows in for free. Renders in its own pane (volume
 * category, oscillator-shape around zero).
 *
 * Defaults `{ fastLength: 3, slowLength: 10 }` (TradingView /
 * invinite canonical). ADL has warmup 0; the slow EMA seeds at bar
 * `slowLength − 1`, so the oscillator first emits a finite value at
 * that bar.
 *
 * **Tick mode.** The sub-slots handle their own tick replay (ADL
 * snapshots `prevClosedCumAdl`; EMA snapshots `prevClosedEma`); this
 * primitive's parent slot just re-evaluates `fastEma − slowEma`
 * against the live sub-slot heads and `replaceHead`s its own output.
 *
 * @formula  chaikinOsc[t] = ema(adl(t), fastLength) − ema(adl(t), slowLength)
 * @warmup   slowLength − 1
 * @since 0.2
 * @stable
 *
 * `opts.offset` shifts the returned series so `series.current` reads
 * the value `offset` bars ago (PLAN.md §9.1).
 *
 * @example
 *     // import { ta, plot } from "@invinite-org/chartlang-core";
 *     // const c = ta.chaikinOsc();
 *     // plot(c);
 */
export function chaikinOsc(slotId: string, opts?: ChaikinOscOpts): Series<number> {
    const ctx = getCtx();
    const fastLength = opts?.fastLength ?? DEFAULT_FAST;
    const slowLength = opts?.slowLength ?? DEFAULT_SLOW;
    const offset = opts?.offset ?? 0;

    const adlSeries = adl(`${slotId}/adl`);
    const fastSeries = ema(`${slotId}/fast`, adlSeries.current, fastLength);
    const slowSeries = ema(`${slotId}/slow`, adlSeries.current, slowLength);

    let slot = ctx.stream.taSlots.get(slotId) as ChaikinOscSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const value = diff(fastSeries.current, slowSeries.current);
    if (ctx.isTick) slot.outBuffer.replaceHead(value);
    else slot.outBuffer.append(value);
    return viewForOffset(slot, offset);
}
