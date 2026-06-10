// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// No invinite source — semantics per Pine `ta.barssince`. See PLAN.md §3.1.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape.

import type { BarssinceOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView, makeShiftedSeriesView } from "../seriesView";

type BarssinceSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly shiftedSeries: Map<number, Series<number>>;
    /** Bars elapsed since the most recent `condition === true`. */
    sinceTrue: number;
    /** Whether any `true` has ever been seen. */
    seenTrue: boolean;
    /** Snapshot BEFORE the most recent close (for tick replay). */
    prevSinceTrue: number;
    prevSeenTrue: boolean;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.barssince called outside an active script step");
    }
    return ctx;
}

function initSlot(capacity: number): BarssinceSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        shiftedSeries: new Map(),
        sinceTrue: 0,
        seenTrue: false,
        prevSinceTrue: 0,
        prevSeenTrue: false,
    };
}

function closeValue(slot: BarssinceSlot, fired: boolean): number {
    slot.prevSinceTrue = slot.sinceTrue;
    slot.prevSeenTrue = slot.seenTrue;
    if (fired) {
        slot.sinceTrue = 0;
        slot.seenTrue = true;
    } else if (slot.seenTrue) {
        slot.sinceTrue += 1;
    }
    return slot.seenTrue ? slot.sinceTrue : Number.NaN;
}

function tickValue(slot: BarssinceSlot, fired: boolean): number {
    // Replay against pre-close snapshot.
    let sinceTrue = slot.prevSinceTrue;
    let seenTrue = slot.prevSeenTrue;
    if (fired) {
        sinceTrue = 0;
        seenTrue = true;
    } else if (seenTrue) {
        sinceTrue += 1;
    }
    return seenTrue ? sinceTrue : Number.NaN;
}

/**
 * Number of bars since `condition === true` last fired. `0` at the
 * matching bar, `1` the next bar, etc. NaN until the first ever match.
 * NaN-condition values are treated as `false` — they do NOT reset the
 * counter.
 *
 * @formula  out[t] = 0 if condition[t]; out[t − 1] + 1 if seenTrue; NaN otherwise
 * @warmup   data-dependent — NaN until the first `condition === true`
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const fast = ta.ema(bar.close, 12);
 *     // const slow = ta.ema(bar.close, 26);
 *     // const sinceCross = ta.barssince(ta.crossover(fast, slow));
 *     // plot(sinceCross);
 */
export function barssince(
    slotId: string,
    condition: Series<boolean>,
    opts: BarssinceOpts = {},
): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as BarssinceSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const fired = condition.current === true;
    if (ctx.isTick) {
        slot.outBuffer.replaceHead(tickValue(slot, fired));
    } else {
        slot.outBuffer.append(closeValue(slot, fired));
    }
    const offset = opts.offset ?? 0;
    if (offset === 0) return slot.series;
    const shifted = slot.shiftedSeries.get(offset);
    if (shifted !== undefined) return shifted;
    const next = makeShiftedSeriesView<number>(slot.outBuffer, offset);
    slot.shiftedSeries.set(offset, next);
    return next;
}
