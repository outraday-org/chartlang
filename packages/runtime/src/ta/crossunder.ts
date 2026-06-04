// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// No invinite source — Phase-1 new code, semantics per Pine
// `ta.crossover` / `ta.crossunder`. See PLAN.md §3.1.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape.

import type { Series } from "@invinite-org/chartlang-core";

import { RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView } from "../seriesView";
import { type ScalarOrSeries, readSourceValue } from "./sourceValue";

type CrossSlot = {
    readonly outBuffer: RingBuffer<boolean>;
    readonly series: Series<boolean>;
    prevA: number;
    prevB: number;
    currA: number;
    currB: number;
    initialised: boolean;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.crossunder called outside an active script step");
    }
    return ctx;
}

function initSlot(capacity: number): CrossSlot {
    const outBuffer = new RingBuffer<boolean>(capacity);
    return {
        outBuffer,
        series: makeSeriesView<boolean>(outBuffer) as Series<boolean>,
        prevA: Number.NaN,
        prevB: Number.NaN,
        currA: Number.NaN,
        currB: Number.NaN,
        initialised: false,
    };
}

function detect(prevA: number, prevB: number, currA: number, currB: number): boolean {
    if (
        !Number.isFinite(prevA) ||
        !Number.isFinite(prevB) ||
        !Number.isFinite(currA) ||
        !Number.isFinite(currB)
    ) {
        return false;
    }
    return currA < currB && prevA >= prevB;
}

/**
 * `true` exactly at the bar where `a` crosses below `b`: `a.current <
 * b.current && a.prev >= b.prev`. Mirror of {@link crossover}; NaN
 * inputs yield `false`.
 *
 * @formula  out[t] = a[t] < b[t] && a[t − 1] ≥ b[t − 1] (else false)
 * @warmup   1
 * @since 0.1
 * @experimental
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const c = ta.crossunder("slot", fastEma, slowEma);
 *     // if (c.current) { ... }
 */
export function crossunder(slotId: string, a: ScalarOrSeries, b: ScalarOrSeries): Series<boolean> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as CrossSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const aValue = readSourceValue(a);
    const bValue = readSourceValue(b);
    if (ctx.isTick) {
        const out = detect(slot.prevA, slot.prevB, aValue, bValue);
        slot.outBuffer.replaceHead(out);
        return slot.series;
    }
    if (!slot.initialised) {
        slot.initialised = true;
        slot.prevA = aValue;
        slot.prevB = bValue;
        slot.currA = aValue;
        slot.currB = bValue;
        slot.outBuffer.append(false);
        return slot.series;
    }
    slot.prevA = slot.currA;
    slot.prevB = slot.currB;
    slot.currA = aValue;
    slot.currB = bValue;
    slot.outBuffer.append(detect(slot.prevA, slot.prevB, slot.currA, slot.currB));
    return slot.series;
}
