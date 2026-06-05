// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/bbw.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. Math scale follows the task spec
// `(upper − lower) / middle` (raw ratio); invinite multiplies by 100
// render-side for TV-parity display. BBW composes `ta.bb` via
// sub-slot `${slotId}/bb` so a fix to the BB envelope flows in for free.

import type { BbResult, BbwOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView } from "../seriesView";
import { bb } from "./bb";
import type { ScalarOrSeries } from "./lib/sourceValue";

const DEFAULT_MULTIPLIER = 2;

type BbwSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly length: number;
    readonly multiplier: number;
    bbSub: BbResult | null;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.bbw called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, multiplier: number, capacity: number): BbwSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        length,
        multiplier,
        bbSub: null,
    };
}

function bbwValue(upper: number, middle: number, lower: number): number {
    if (
        !Number.isFinite(upper) ||
        !Number.isFinite(middle) ||
        !Number.isFinite(lower) ||
        middle === 0
    ) {
        return Number.NaN;
    }
    return (upper - lower) / middle;
}

/**
 * Bollinger BandWidth — sub-pane volatility line. Compresses
 * ("squeezes") before breakouts. Composes `ta.bb` via sub-slot
 * `${slotId}/bb` — a fix to the BB envelope flows in for free.
 * Emits the raw ratio `(upper − lower) / middle`; multiply by 100
 * in the script for TradingView-parity display. NaN when the SMA
 * middle is zero or during warmup.
 *
 * @formula  bands = bb(source, length, { multiplier }) ;
 *           bbw   = (bands.upper − bands.lower) / bands.middle
 * @warmup   length − 1
 * @since 0.2
 * @experimental
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const width = ta.bbw(bar.close, 20, { multiplier: 2 });
 *     // plot(width);
 */
export function bbw(
    slotId: string,
    source: ScalarOrSeries,
    length: number,
    opts?: BbwOpts,
): Series<number> {
    const ctx = getCtx();
    const multiplier = opts?.multiplier ?? DEFAULT_MULTIPLIER;
    let slot = ctx.stream.taSlots.get(slotId) as BbwSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(length, multiplier, ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const bands = bb(`${slotId}/bb`, source, length, { multiplier });
    if (slot.bbSub === null) slot.bbSub = bands;
    const value = bbwValue(bands.upper.current, bands.middle.current, bands.lower.current);
    if (ctx.isTick) {
        slot.outBuffer.replaceHead(value);
    } else {
        slot.outBuffer.append(value);
    }
    return slot.series;
}
