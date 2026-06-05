// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// No invinite source — semantics per Pine `ta.valuewhen`. See PLAN.md §3.1.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape.

import type { Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView } from "../seriesView";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue";

type ValuewhenSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly occurrence: number;
    readonly capacity: number;
    /**
     * Oldest-first source values at the last `occurrence + 1` matching
     * bars. Length grows to `capacity = occurrence + 1` and then the
     * front is shifted on each subsequent match.
     */
    ring: number[];
    /** Total matches ever seen across the stream. */
    matchCount: number;
    /** Snapshot of `ring` BEFORE the most recent close-side update. */
    prevRing: ReadonlyArray<number>;
    /** Snapshot of `matchCount` BEFORE the most recent close-side update. */
    prevMatchCount: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.valuewhen called outside an active script step");
    }
    return ctx;
}

function readBoolean(condition: Series<boolean>): boolean {
    return condition.current;
}

function initSlot(occurrence: number, capacity: number): ValuewhenSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    const ringCapacity = occurrence + 1;
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        occurrence,
        capacity: ringCapacity,
        ring: [],
        matchCount: 0,
        prevRing: [],
        prevMatchCount: 0,
    };
}

function emitFromState(
    occurrence: number,
    ring: ReadonlyArray<number>,
    matchCount: number,
): number {
    if (matchCount < occurrence + 1) return Number.NaN;
    // The ring is oldest-first within its capacity (occurrence + 1).
    // The `occurrence`-th most recent match is the OLDEST entry in a
    // full ring — i.e. ring[0].
    return ring[0];
}

function closeValue(slot: ValuewhenSlot, src: number, fired: boolean): number {
    slot.prevRing = slot.ring.slice();
    slot.prevMatchCount = slot.matchCount;
    if (fired) {
        slot.ring.push(src);
        if (slot.ring.length > slot.capacity) slot.ring.shift();
        slot.matchCount += 1;
    }
    return emitFromState(slot.occurrence, slot.ring, slot.matchCount);
}

function tickValue(slot: ValuewhenSlot, src: number, fired: boolean): number {
    // Replay against the snapshot taken before the most recent close.
    const ring = slot.prevRing.slice();
    let count = slot.prevMatchCount;
    if (fired) {
        ring.push(src);
        if (ring.length > slot.capacity) ring.shift();
        count += 1;
    }
    return emitFromState(slot.occurrence, ring, count);
}

/**
 * Source value at the bar of the n-th most recent `condition === true`.
 * `occurrence === 0` returns the value at the most recent match;
 * `occurrence === 1` the second most recent; etc. NaN until
 * `occurrence + 1` matches have been seen.
 *
 * NaN-source at the matching bar produces NaN in the ring entry, which
 * surfaces as NaN once that entry is the one emitted. Matches NaN-source
 * semantics in Pine.
 *
 * @formula  out[t] = source[bar of n-th most recent condition true],
 *           NaN until `occurrence + 1` matches
 * @warmup   bar of the `occurrence + 1`-th match (data-dependent)
 * @since 0.2
 * @experimental
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const fast = ta.sma(bar.close, 10);
 *     // const slow = ta.sma(bar.close, 30);
 *     // const onCross = ta.valuewhen(ta.crossover(fast, slow), bar.close);
 *     // plot(onCross);
 */
export function valuewhen(
    slotId: string,
    condition: Series<boolean>,
    source: ScalarOrSeries,
    occurrence = 0,
): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as ValuewhenSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(occurrence, ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const fired = readBoolean(condition);
    const src = readSourceValue(source);
    if (ctx.isTick) {
        slot.outBuffer.replaceHead(tickValue(slot, src, fired));
    } else {
        slot.outBuffer.append(closeValue(slot, src, fired));
    }
    return slot.series;
}
