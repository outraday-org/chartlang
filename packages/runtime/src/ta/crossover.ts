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
    /** Prior closed-bar values of `a` and `b` (rolling 2-slot history). */
    prevA: number;
    prevB: number;
    /** As-of-current-close values, frozen so ticks replay against prior. */
    currA: number;
    currB: number;
    initialised: boolean;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.crossover called outside an active script step");
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
    return currA > currB && prevA <= prevB;
}

/**
 * `true` exactly at the bar where `a` crosses above `b`: `a.current >
 * b.current && a.prev <= b.prev`. `b` may be a scalar (treated as a
 * constant series). NaN inputs yield `false` — Pine semantics for
 * Boolean series (NaN doesn't bubble through booleans).
 *
 * The slot keeps a 2-slot history of both `a` and `b` so scalar
 * sources work without the caller wrapping them. Tick-mode replays
 * the head with the prior closed-bar's `(a, b)` pair so a partial-
 * bar value doesn't seed the next close's comparison.
 *
 * @formula  out[t] = a[t] > b[t] && a[t − 1] ≤ b[t − 1] (else false)
 * @warmup   1 (need a prior bar)
 * @since 0.1
 * @experimental
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const c = ta.crossover("slot", fastEma, slowEma);
 *     // if (c.current) { ... }
 */
export function crossover(slotId: string, a: ScalarOrSeries, b: ScalarOrSeries): Series<boolean> {
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
    // Standard close-side advance: prev becomes currA/B, currA/B become the new sample.
    slot.prevA = slot.currA;
    slot.prevB = slot.currB;
    slot.currA = aValue;
    slot.currB = bValue;
    slot.outBuffer.append(detect(slot.prevA, slot.prevB, slot.currA, slot.currB));
    return slot.series;
}
