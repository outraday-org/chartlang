// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/ichimoku.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. Ichimoku composes six `ta.highest` / `ta.lowest`
// sub-slots (one pair each for Tenkan / Kijun / Senkou B) — the same
// composition seam `donchian.ts` uses — so a fix to highest/lowest
// flows in for free. The forward-displaced Senkou A / Senkou B and
// backward-displaced Chikou are produced via per-slot delay ring
// buffers of capacity `displacement + 1`.

import type { IchimokuOpts, IchimokuResult } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView, makeShiftedSeriesView } from "../seriesView";
import { highest } from "./highest";
import { lowest } from "./lowest";

const DEFAULT_CONVERSION_LENGTH = 9;
const DEFAULT_BASE_LENGTH = 26;
const DEFAULT_LEADING_SPAN_B_LENGTH = 52;
const DEFAULT_DISPLACEMENT = 26;

type IchimokuSlot = {
    readonly outputs: IchimokuResult;
    readonly tenkanBuffer: Float64RingBuffer;
    readonly kijunBuffer: Float64RingBuffer;
    readonly senkouABuffer: Float64RingBuffer;
    readonly senkouBBuffer: Float64RingBuffer;
    readonly chikouBuffer: Float64RingBuffer;
    readonly conversionLength: number;
    readonly baseLength: number;
    readonly leadingSpanBLength: number;
    readonly displacement: number;
    /** Forward-shift delay for senkouA: capacity `displacement + 1`.
     * At each close we append the new `senkouARaw`; `at(displacement)`
     * gives the value from `displacement` closes ago — exactly the
     * value we emit for `senkouA[t]`. */
    readonly senkouADelay: Float64RingBuffer;
    readonly senkouBDelay: Float64RingBuffer;
    /** Backward-shift delay for chikou: capacity `displacement + 1`.
     * `chikou[t] = close[t − displacement]` — at each close we append
     * the new close; `at(displacement)` gives the value from
     * `displacement` closes ago. */
    readonly closeDelay: Float64RingBuffer;
    readonly shiftedResults: Map<number, IchimokuResult>;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.ichimoku called outside an active script step");
    }
    return ctx;
}

function midpoint(hi: number, lo: number): number {
    if (!Number.isFinite(hi) || !Number.isFinite(lo)) return Number.NaN;
    return (hi + lo) / 2;
}

function spanAverage(a: number, b: number): number {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.NaN;
    return (a + b) / 2;
}

function delayedValue(delay: Float64RingBuffer, displacement: number): number {
    if (delay.length <= displacement) return Number.NaN;
    return delay.at(displacement);
}

function initSlot(
    capacity: number,
    conversionLength: number,
    baseLength: number,
    leadingSpanBLength: number,
    displacement: number,
): IchimokuSlot {
    const tenkanBuffer = new Float64RingBuffer(capacity);
    const kijunBuffer = new Float64RingBuffer(capacity);
    const senkouABuffer = new Float64RingBuffer(capacity);
    const senkouBBuffer = new Float64RingBuffer(capacity);
    const chikouBuffer = new Float64RingBuffer(capacity);
    // The delay ring buffers need only `displacement + 1` slots — at
    // each close we append the new raw value; `at(displacement)`
    // returns the value from `displacement` closes ago.
    const delayCap = displacement + 1;
    return {
        outputs: Object.freeze({
            tenkan: makeSeriesView<number>(tenkanBuffer),
            kijun: makeSeriesView<number>(kijunBuffer),
            senkouA: makeSeriesView<number>(senkouABuffer),
            senkouB: makeSeriesView<number>(senkouBBuffer),
            chikou: makeSeriesView<number>(chikouBuffer),
        }),
        tenkanBuffer,
        kijunBuffer,
        senkouABuffer,
        senkouBBuffer,
        chikouBuffer,
        conversionLength,
        baseLength,
        leadingSpanBLength,
        displacement,
        senkouADelay: new Float64RingBuffer(delayCap),
        senkouBDelay: new Float64RingBuffer(delayCap),
        closeDelay: new Float64RingBuffer(delayCap),
        shiftedResults: new Map(),
    };
}

function resultForOffset(slot: IchimokuSlot, offset: number): IchimokuResult {
    if (offset === 0) return slot.outputs;
    let cached = slot.shiftedResults.get(offset);
    if (cached === undefined) {
        cached = Object.freeze({
            tenkan: makeShiftedSeriesView<number>(slot.tenkanBuffer, offset),
            kijun: makeShiftedSeriesView<number>(slot.kijunBuffer, offset),
            senkouA: makeShiftedSeriesView<number>(slot.senkouABuffer, offset),
            senkouB: makeShiftedSeriesView<number>(slot.senkouBBuffer, offset),
            chikou: makeShiftedSeriesView<number>(slot.chikouBuffer, offset),
        });
        slot.shiftedResults.set(offset, cached);
    }
    return cached;
}

/**
 * Ichimoku Cloud — five-line trend / cloud overlay. Composes six
 * `ta.highest` / `ta.lowest` sub-slots (Tenkan high+low, Kijun
 * high+low, Senkou B high+low) — the same composition seam
 * `ta.donchian` uses — so a fix to either rolling-extreme primitive
 * flows in for free. Forward-displaced Senkou A / Senkou B and
 * backward-displaced Chikou are produced via per-slot delay ring
 * buffers of capacity `displacement + 1`.
 *
 * `chikou.current` returns `close[t − displacement]` (the close from
 * `displacement` bars ago, plotted at today's position — the
 * lagging-span semantic). Renderer-side, the script author may
 * choose to draw it at the visually-offset position; the runtime
 * exposes the backward-shifted value so script-author conditionals
 * (cross / alert) see meaningful data.
 *
 * @formula  tenkan[t]  = (highest(high, conversionLength) + lowest(low, conversionLength)) / 2 ;
 *           kijun[t]   = (highest(high, baseLength)       + lowest(low, baseLength))       / 2 ;
 *           senkouARaw = (tenkan + kijun) / 2 ;
 *           senkouBRaw = (highest(high, leadingSpanBLength) + lowest(low, leadingSpanBLength)) / 2 ;
 *           senkouA[t] = senkouARaw[t − displacement] ;
 *           senkouB[t] = senkouBRaw[t − displacement] ;
 *           chikou[t]  = close[t − displacement]
 * @anchors  displacement, conversionLength, baseLength, leadingSpanBLength
 * @warmup   max(conversionLength, baseLength, leadingSpanBLength) + displacement − 1
 * @since 0.2
 * @stable
 *
 * `opts.offset` shifts all five outputs in lockstep (PLAN.md §9.1).
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const i = ta.ichimoku("slot");
 *     // plot(i.tenkan);
 *     // plot(i.kijun);
 *     // plot(i.senkouA);
 *     // plot(i.senkouB);
 *     // plot(i.chikou);
 */
export function ichimoku(slotId: string, opts?: IchimokuOpts): IchimokuResult {
    const ctx = getCtx();
    const conversionLength = opts?.conversionLength ?? DEFAULT_CONVERSION_LENGTH;
    const baseLength = opts?.baseLength ?? DEFAULT_BASE_LENGTH;
    const leadingSpanBLength = opts?.leadingSpanBLength ?? DEFAULT_LEADING_SPAN_B_LENGTH;
    const displacement = opts?.displacement ?? DEFAULT_DISPLACEMENT;
    const offset = opts?.offset ?? 0;
    const bar = ctx.stream.bar;

    let slot = ctx.stream.taSlots.get(slotId) as IchimokuSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(
            ctx.stream.ohlcv.close.capacity,
            conversionLength,
            baseLength,
            leadingSpanBLength,
            displacement,
        );
        ctx.stream.taSlots.set(slotId, slot);
    }

    // Compose: rolling extremes via the registered ta.highest /
    // ta.lowest sub-slots. Each composed call advances the sub-slot on
    // the same close (or replaces its head on the same tick).
    const tenkanHi = highest(`${slotId}/tenkanHigh`, bar.high, conversionLength).current;
    const tenkanLo = lowest(`${slotId}/tenkanLow`, bar.low, conversionLength).current;
    const kijunHi = highest(`${slotId}/kijunHigh`, bar.high, baseLength).current;
    const kijunLo = lowest(`${slotId}/kijunLow`, bar.low, baseLength).current;
    const senkouBHi = highest(`${slotId}/senkouBHigh`, bar.high, leadingSpanBLength).current;
    const senkouBLo = lowest(`${slotId}/senkouBLow`, bar.low, leadingSpanBLength).current;

    const tenkan = midpoint(tenkanHi, tenkanLo);
    const kijun = midpoint(kijunHi, kijunLo);
    const senkouBRaw = midpoint(senkouBHi, senkouBLo);
    const senkouARaw = spanAverage(tenkan, kijun);

    if (ctx.isTick) {
        // Replace the head of the delay buffers with the tick's
        // updated raw values. `at(displacement)` then returns the
        // SAME value as before (the displacement-shifted slot is not
        // affected by the head's value), so the displaced output
        // heads are stable on tick.
        slot.senkouADelay.replaceHead(senkouARaw);
        slot.senkouBDelay.replaceHead(senkouBRaw);
        slot.closeDelay.replaceHead(bar.close);
        slot.tenkanBuffer.replaceHead(tenkan);
        slot.kijunBuffer.replaceHead(kijun);
        slot.senkouABuffer.replaceHead(delayedValue(slot.senkouADelay, displacement));
        slot.senkouBBuffer.replaceHead(delayedValue(slot.senkouBDelay, displacement));
        slot.chikouBuffer.replaceHead(delayedValue(slot.closeDelay, displacement));
    } else {
        slot.senkouADelay.append(senkouARaw);
        slot.senkouBDelay.append(senkouBRaw);
        slot.closeDelay.append(bar.close);
        slot.tenkanBuffer.append(tenkan);
        slot.kijunBuffer.append(kijun);
        slot.senkouABuffer.append(delayedValue(slot.senkouADelay, displacement));
        slot.senkouBBuffer.append(delayedValue(slot.senkouBDelay, displacement));
        slot.chikouBuffer.append(delayedValue(slot.closeDelay, displacement));
    }

    return resultForOffset(slot, offset);
}
