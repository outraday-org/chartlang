// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/bop.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. The runtime emits the RAW per-bar BOP
// `(close - open) / (high - low)` only; invinite's optional SMA
// smoothing knob is left to the script author (`ta.sma(ta.bop(), n)`).

import type { BopOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView } from "../seriesView.js";

type BopSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.bop called outside an active script step");
    }
    return ctx;
}

function initSlot(capacity: number): BopSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return { outBuffer, series: makeSeriesView<number>(outBuffer) };
}

function bopAt(open: number, high: number, low: number, close: number): number {
    if (
        !Number.isFinite(open) ||
        !Number.isFinite(high) ||
        !Number.isFinite(low) ||
        !Number.isFinite(close)
    ) {
        return Number.NaN;
    }
    const range = high - low;
    if (range === 0) return 0;
    return (close - open) / range;
}

/**
 * Balance of Power — `(close − open) / (high − low)` per bar. Raw,
 * unsmoothed output; flat-range bars contribute 0 (matches invinite's
 * defensive guard). NaN OHLC inputs emit NaN. No warmup — every bar
 * is independent.
 *
 * The script author can wrap this in `ta.sma(ta.bop(), n)` to recover
 * TradingView's optional smoothing pairing.
 *
 * @formula  out[t] = (close[t] − open[t]) / (high[t] − low[t])
 * @warmup   0
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta, plot } from "@invinite-org/chartlang-core";
 *     // const b = ta.bop();
 *     // plot(b);
 */
export function bop(slotId: string, _opts?: BopOpts): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as BopSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const { open, high, low, close } = ctx.stream.bar;
    const value = bopAt(open, high, low, close);
    if (ctx.isTick) {
        slot.outBuffer.replaceHead(value);
    } else {
        slot.outBuffer.append(value);
    }
    return slot.series;
}
