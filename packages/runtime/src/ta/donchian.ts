// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/donchian.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. Reads `bar.high` / `bar.low` directly (no
// source param, mirrors Pine's `ta.highest` / `ta.lowest` over the
// `high` / `low` series). Composes the registered `ta.highest` /
// `ta.lowest` primitives via sub-slots `${slotId}/highest` and
// `${slotId}/lowest` — the math equivalent of `lib/donchianMid`
// (used by `ta.ichimoku` in its full-recompute path) but routed
// through the slot-aware registry so a fix to either primitive
// flows in for free.

import type { DonchianOpts, DonchianResult } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView } from "../seriesView";
import { highest } from "./highest";
import { lowest } from "./lowest";

type DonchianSlot = {
    readonly middleBuffer: Float64RingBuffer;
    readonly length: number;
    outputs: DonchianResult | null;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.donchian called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, capacity: number): DonchianSlot {
    return {
        middleBuffer: new Float64RingBuffer(capacity),
        length,
        outputs: null,
    };
}

function middleValue(upper: number, lower: number): number {
    if (!Number.isFinite(upper) || !Number.isFinite(lower)) return Number.NaN;
    return (upper + lower) / 2;
}

/**
 * Donchian Channels — overlay volatility indicator. Highest high and
 * lowest low over a fixed `length`-bar window form the upper / lower
 * band; their midpoint is the centerline. Reads `bar.high` /
 * `bar.low` directly (no source param, mirrors Pine). Composes the
 * registered `ta.highest` / `ta.lowest` primitives via sub-slots
 * `${slotId}/highest` and `${slotId}/lowest` — the math equivalent of
 * `lib/donchianMid` but routed through the slot-aware registry so a
 * fix to either primitive flows in for free. Returns a cached
 * `{ upper, middle, lower }` record (same identity every bar). NaN
 * across all outputs while the trailing window is fully unwarmed.
 *
 * @formula  upper  = highest(bar.high, length) ;
 *           lower  = lowest(bar.low, length) ;
 *           middle = (upper + lower) / 2
 * @warmup   length − 1
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const d = ta.donchian(20);
 *     // plot(d.upper);
 *     // plot(d.middle);
 *     // plot(d.lower);
 */
export function donchian(slotId: string, length: number, _opts?: DonchianOpts): DonchianResult {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as DonchianSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(length, ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const upperSeries = highest(`${slotId}/highest`, ctx.stream.bar.high, length);
    const lowerSeries = lowest(`${slotId}/lowest`, ctx.stream.bar.low, length);
    if (slot.outputs === null) {
        slot.outputs = Object.freeze({
            upper: upperSeries,
            middle: makeSeriesView<number>(slot.middleBuffer),
            lower: lowerSeries,
        });
    }
    const value = middleValue(upperSeries.current, lowerSeries.current);
    if (ctx.isTick) {
        slot.middleBuffer.replaceHead(value);
    } else {
        slot.middleBuffer.append(value);
    }
    return slot.outputs;
}
