// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/dpo.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape. Composition: `ta.sma`
// over the source via a sub-slot (`${slotId}/sma`); a per-slot
// `sourceWindow` Float64RingBuffer carries the trailing
// `displacement + 1` source values for the `src[t − displacement]`
// lookback.
//
// DEVIATION from invinite: only the non-centered (default) render
// mode is shipped. Invinite's `centered: true` mode emits
// `dpo[i] = src[i] - sma[i + displacement]`, which depends on the
// future SMA; chartlang's append-only ring-buffer contract can't
// backfill earlier emissions when the future SMA confirms, so we'd
// have to emit centered as NaN at the head until the future SMA
// lands — the visual would diverge from invinite. The non-centered
// mode is the TradingView "shifts back to the right to match current
// price" default, which is what most authors want.

import type { DpoOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView, makeShiftedSeriesView } from "../seriesView.js";
import { sma } from "./sma.js";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue.js";

type DpoSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly length: number;
    readonly displacement: number;
    /** Source values across the trailing `displacement + 1` bars. `at(0)` is the head. */
    readonly sourceWindow: Float64RingBuffer;
    /** Number of closed bars folded into the slot so far. */
    barCount: number;
    /** Per-offset Series-view cache. */
    readonly shiftedViews: Map<number, Series<number>>;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.dpo called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, capacity: number): DpoSlot {
    const displacement = Math.floor(length / 2) + 1;
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        length,
        displacement,
        sourceWindow: new Float64RingBuffer(displacement + 1),
        barCount: 0,
        shiftedViews: new Map(),
    };
}

function viewForOffset(slot: DpoSlot, offset: number): Series<number> {
    if (offset === 0) return slot.series;
    let view = slot.shiftedViews.get(offset);
    if (view === undefined) {
        view = makeShiftedSeriesView<number>(slot.outBuffer, offset);
        slot.shiftedViews.set(offset, view);
    }
    return view;
}

function computeDpo(slot: DpoSlot, smaCurrent: number): number {
    if (slot.sourceWindow.length <= slot.displacement) return Number.NaN;
    if (!Number.isFinite(smaCurrent)) return Number.NaN;
    const shifted = slot.sourceWindow.at(slot.displacement);
    if (!Number.isFinite(shifted)) return Number.NaN;
    return shifted - smaCurrent;
}

/**
 * Detrended Price Oscillator — strips the SMA trend out of price so
 * the remaining oscillator visualises the short-cycle component.
 * Non-centered (default) mode: `dpo[i] = source[i − displacement]
 * − sma[i]` with `displacement = floor(length / 2) + 1`. Composes
 * `ta.sma(${slotId}/sma, src, length)`; a per-slot source window
 * carries the trailing `displacement + 1` bars so the
 * `source[i − displacement]` lookback is O(1) per close.
 *
 * @formula  displacement = floor(length / 2) + 1 ;
 *           sma[i]        = mean(source[i − length + 1 ..= i]) ;
 *           dpo[i]        = source[i − displacement] − sma[i]
 * @warmup   length
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const d = ta.dpo("slot", bar.close, 21);
 *     // const head = d.current;
 */
export function dpo(
    slotId: string,
    source: ScalarOrSeries,
    length: number,
    opts?: DpoOpts,
): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as DpoSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(length, ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const src = readSourceValue(source);
    if (ctx.isTick) {
        slot.sourceWindow.replaceHead(src);
        const smaSeries = sma(`${slotId}/sma`, src, length);
        slot.outBuffer.replaceHead(computeDpo(slot, smaSeries.current));
    } else {
        slot.sourceWindow.append(src);
        slot.barCount += 1;
        const smaSeries = sma(`${slotId}/sma`, src, length);
        slot.outBuffer.append(computeDpo(slot, smaSeries.current));
    }
    return viewForOffset(slot, opts?.offset ?? 0);
}
