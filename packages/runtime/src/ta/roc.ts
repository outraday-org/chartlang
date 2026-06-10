// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/roc.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.

import type { RocOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView } from "../seriesView";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue";

type RocSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly length: number;
    readonly sourceWindow: Float64RingBuffer;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.roc called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, capacity: number): RocSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        length,
        sourceWindow: new Float64RingBuffer(length + 1),
    };
}

function rocValue(head: number, old: number): number {
    if (!Number.isFinite(head) || !Number.isFinite(old) || old === 0) return Number.NaN;
    return (100 * (head - old)) / old;
}

function closeValue(slot: RocSlot, src: number): number {
    slot.sourceWindow.append(src);
    if (slot.sourceWindow.length <= slot.length) return Number.NaN;
    const head = slot.sourceWindow.at(0);
    const old = slot.sourceWindow.at(slot.length);
    return rocValue(head, old);
}

function tickValue(slot: RocSlot, src: number): number {
    // Tick replaces the head bar's source. Warmup count is based on
    // CLOSED bars in the window — an unwarmed slot returns NaN.
    if (slot.sourceWindow.length <= slot.length) return Number.NaN;
    const old = slot.sourceWindow.at(slot.length);
    return rocValue(src, old);
}

/**
 * Rate of Change — `100 × (source[0] − source[length]) / source[length]`.
 * NaN when either operand is NaN or the lagged source is exactly `0`
 * (division-by-zero guard). Warmup is `length` bars.
 *
 * @formula  out[t] = 100 · (source[t] − source[t − length]) / source[t − length]
 * @warmup   length
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const r = ta.roc("slot", bar.close, 12);
 *     // const head = r.current;
 */
export function roc(
    slotId: string,
    source: ScalarOrSeries,
    length: number,
    _opts?: RocOpts,
): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as RocSlot | undefined;
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
