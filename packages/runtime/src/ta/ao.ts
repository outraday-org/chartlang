// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/ao.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.

import type { AoOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView } from "../seriesView.js";
import { sma } from "./sma.js";

const DEFAULT_FAST_LENGTH = 5;
const DEFAULT_SLOW_LENGTH = 34;

type AoSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly fastSmaSub: string;
    readonly slowSmaSub: string;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.ao called outside an active script step");
    }
    return ctx;
}

function initSlot(capacity: number, slotId: string): AoSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        fastSmaSub: `${slotId}/fastSma`,
        slowSmaSub: `${slotId}/slowSma`,
    };
}

function combine(fast: number, slow: number): number {
    if (!Number.isFinite(fast) || !Number.isFinite(slow)) return Number.NaN;
    return fast - slow;
}

/**
 * Awesome Oscillator — `SMA(hl2, fastLength) − SMA(hl2, slowLength)`.
 * Sources from `bar.hl2` directly (no `source` arg — matches Pine
 * `ta.ao()`). Defaults to `fastLength = 5`, `slowLength = 34`.
 * Composes two `ta.sma` sub-slots (`${slotId}/fastSma`,
 * `${slotId}/slowSma`); a fix to `sma` flows in for free. Warmup is
 * `slowLength − 1` bars (the longer SMA dominates).
 *
 * @formula  AO[t] = SMA(hl2, fastLength)[t] − SMA(hl2, slowLength)[t]
 * @warmup   slowLength − 1
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const a = ta.ao("slot");
 *     // const head = a.current;
 */
export function ao(slotId: string, opts?: AoOpts): Series<number> {
    const ctx = getCtx();
    const fastLength = opts?.fastLength ?? DEFAULT_FAST_LENGTH;
    const slowLength = opts?.slowLength ?? DEFAULT_SLOW_LENGTH;
    let slot = ctx.stream.taSlots.get(slotId) as AoSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(ctx.stream.ohlcv.close.capacity, slotId);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const hl2 = ctx.stream.bar.hl2;
    const fastSeries = sma(slot.fastSmaSub, hl2, fastLength);
    const slowSeries = sma(slot.slowSmaSub, hl2, slowLength);
    const value = combine(fastSeries.current, slowSeries.current);
    if (ctx.isTick) {
        slot.outBuffer.replaceHead(value);
    } else {
        slot.outBuffer.append(value);
    }
    return slot.series;
}
