// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/cci.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. `scaling = 0.015` is hard-coded per the
// task spec; CciOpts intentionally narrows away invinite's `scaling`
// knob.

import type { CciOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView } from "../seriesView";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue";

const SCALING = 0.015;

type CciSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly length: number;
    /** Closed source (typical price) values across the trailing `length` bars. */
    readonly typicalPriceWindow: Float64RingBuffer;
    sumTp: number;
    /** Number of closed bars folded into the slot. */
    count: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.cci called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, capacity: number): CciSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        length,
        typicalPriceWindow: new Float64RingBuffer(length),
        sumTp: 0,
        count: 0,
    };
}

function cciFromCenter(center: number, currentTp: number, meanDev: number): number {
    if (meanDev === 0) return Number.NaN;
    return (currentTp - center) / (SCALING * meanDev);
}

function meanAbsDev(window: Float64RingBuffer, center: number, length: number): number {
    let sumAbs = 0;
    for (let i = 0; i < length; i += 1) {
        const v = window.at(i);
        const dev = v - center;
        sumAbs += dev < 0 ? -dev : dev;
    }
    return sumAbs / length;
}

function closeValue(slot: CciSlot, src: number): number {
    if (!Number.isFinite(src)) {
        // Hold prior — do not advance window; emit NaN when unwarmed,
        // otherwise re-emit the prior CCI using existing window state.
        if (slot.count < slot.length) return Number.NaN;
        const center = slot.sumTp / slot.length;
        const currentTp = slot.typicalPriceWindow.at(0);
        // Defensive: the window head is the most recently appended finite
        // typical price (we never append NaN — the outer `!isFinite(src)`
        // branch above bypasses append). Kept as a safety net.
        /* c8 ignore next */
        if (!Number.isFinite(currentTp)) return Number.NaN;
        const md = meanAbsDev(slot.typicalPriceWindow, center, slot.length);
        return cciFromCenter(center, currentTp, md);
    }
    if (slot.count < slot.length) {
        slot.typicalPriceWindow.append(src);
        slot.sumTp += src;
        slot.count += 1;
        if (slot.count < slot.length) return Number.NaN;
        const center = slot.sumTp / slot.length;
        const md = meanAbsDev(slot.typicalPriceWindow, center, slot.length);
        return cciFromCenter(center, src, md);
    }
    const outgoing = slot.typicalPriceWindow.at(slot.length - 1);
    slot.typicalPriceWindow.append(src);
    slot.sumTp = slot.sumTp + src - outgoing;
    const center = slot.sumTp / slot.length;
    const md = meanAbsDev(slot.typicalPriceWindow, center, slot.length);
    return cciFromCenter(center, src, md);
}

function tickValue(slot: CciSlot, src: number): number {
    if (slot.count < slot.length) return Number.NaN;
    if (!Number.isFinite(src)) {
        // Tick NaN: re-emit the prior closed CCI off the existing window.
        const center = slot.sumTp / slot.length;
        const currentTp = slot.typicalPriceWindow.at(0);
        // Defensive: see closeValue() comment — window head is always finite
        // because non-finite sources skip the append.
        /* c8 ignore next */
        if (!Number.isFinite(currentTp)) return Number.NaN;
        const md = meanAbsDev(slot.typicalPriceWindow, center, slot.length);
        return cciFromCenter(center, currentTp, md);
    }
    // Substitute the head bar's typical price with `src` and recompute.
    const headValue = slot.typicalPriceWindow.at(0);
    const adjustedSum = slot.sumTp - headValue + src;
    const center = adjustedSum / slot.length;
    let sumAbs = 0;
    for (let i = 0; i < slot.length; i += 1) {
        const v = i === 0 ? src : slot.typicalPriceWindow.at(i);
        const dev = v - center;
        sumAbs += dev < 0 ? -dev : dev;
    }
    const md = sumAbs / slot.length;
    return cciFromCenter(center, src, md);
}

/**
 * Commodity Channel Index — momentum oscillator centred on `0`.
 * Compares the source (typically `bar.hlc3`) to its SMA over the
 * trailing `length` bars, normalised by mean absolute deviation
 * with the classic Lambert `scaling = 0.015` constant. Unbounded
 * by construction; `meanDev === 0` (flat-line window) emits `NaN`.
 *
 * @formula  tp           = source[t] ;
 *           sma          = mean(tp[t − length + 1 .. t]) ;
 *           meanAbsDev   = mean(|tp[i] − sma| for i in window) ;
 *           cci          = (tp[t] − sma) / (0.015 · meanAbsDev) ;
 *           NaN          when meanAbsDev === 0
 * @warmup   length − 1
 * @since 0.2
 * @experimental
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const c = ta.cci("slot", bar.hlc3, 20);
 *     // const head = c.current;
 */
export function cci(
    slotId: string,
    source: ScalarOrSeries,
    length: number,
    _opts?: CciOpts,
): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as CciSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(length, ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const src = readSourceValue(source);
    if (ctx.isTick) {
        slot.outBuffer.replaceHead(tickValue(slot, src));
    } else {
        slot.outBuffer.append(closeValue(slot, src));
    }
    return slot.series;
}
