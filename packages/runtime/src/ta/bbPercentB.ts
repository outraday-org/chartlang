// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/bb-percent-b.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. %B is composed from `ta.bb` via a sub-slot
// (`${slotId}/bb`) so a fix to the BB envelope math flows in for free.

import type { BbPercentBOpts, BbResult, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView } from "../seriesView";
import { bb } from "./bb";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue";

const DEFAULT_MULTIPLIER = 2;

type BbPercentBSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly length: number;
    readonly multiplier: number;
    bbSub: BbResult | null;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.bbPercentB called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, multiplier: number, capacity: number): BbPercentBSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        length,
        multiplier,
        bbSub: null,
    };
}

function percentBValue(src: number, upper: number, lower: number): number {
    if (!Number.isFinite(src) || !Number.isFinite(upper) || !Number.isFinite(lower)) {
        return Number.NaN;
    }
    const denom = upper - lower;
    if (denom === 0) return Number.NaN;
    return (src - lower) / denom;
}

/**
 * Bollinger %B — sub-pane oscillator measuring price position
 * relative to the Bollinger Band envelope. `0` sits on the lower
 * band, `1` on the upper; excursions past either signal a volatility
 * breakout. Composes `ta.bb` via sub-slot `${slotId}/bb` — a fix to
 * the BB envelope math flows in for free. NaN when the band collapses
 * (`upper === lower`) or during warmup.
 *
 * @formula  bands  = bb(source, length, { multiplier }) ;
 *           pct    = (source − bands.lower) / (bands.upper − bands.lower)
 * @warmup   length − 1
 * @since 0.2
 * @experimental
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const pct = ta.bbPercentB(bar.close, 20, { multiplier: 2 });
 *     // plot(pct);
 */
export function bbPercentB(
    slotId: string,
    source: ScalarOrSeries,
    length: number,
    opts?: BbPercentBOpts,
): Series<number> {
    const ctx = getCtx();
    const multiplier = opts?.multiplier ?? DEFAULT_MULTIPLIER;
    let slot = ctx.stream.taSlots.get(slotId) as BbPercentBSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(length, multiplier, ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const src = readSourceValue(source);
    const bands = bb(`${slotId}/bb`, source, length, { multiplier });
    if (slot.bbSub === null) slot.bbSub = bands;
    const value = percentBValue(src, bands.upper.current, bands.lower.current);
    if (ctx.isTick) {
        slot.outBuffer.replaceHead(value);
    } else {
        slot.outBuffer.append(value);
    }
    return slot.series;
}
