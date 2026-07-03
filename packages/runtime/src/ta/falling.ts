// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// No invinite source — semantics per Pine `ta.falling`.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape.

import type { Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer, RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView } from "../seriesView.js";
import { monotonic } from "./lib/monotonic.js";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue.js";

type FallingSlot = {
    readonly outBuffer: RingBuffer<boolean>;
    readonly series: Series<boolean>;
    readonly length: number;
    /** Closed-bar source values across the trailing `length + 1` bars. */
    readonly sourceWindow: Float64RingBuffer;
    /** Reusable oldest→newest window handed to `monotonic` each bar. */
    readonly scratch: Float64Array;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.falling called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, capacity: number): FallingSlot {
    const outBuffer = new RingBuffer<boolean>(capacity);
    return {
        outBuffer,
        series: makeSeriesView<boolean>(outBuffer) as Series<boolean>,
        length,
        sourceWindow: new Float64RingBuffer(length + 1),
        scratch: new Float64Array(length + 1),
    };
}

// Fill `scratch` oldest → newest from the closed window, using `head` as
// the newest value (the just-closed source on a close, the in-progress
// tick source on a tick). Reads `at(length)…at(1)` for the older slots so
// the head slot is never double-read.
function monotonicOverWindow(slot: FallingSlot, head: number): boolean {
    const n = slot.length;
    for (let k = 0; k < n; k += 1) {
        slot.scratch[k] = slot.sourceWindow.at(n - k);
    }
    slot.scratch[n] = head;
    return monotonic(slot.scratch, n, -1);
}

function closeValue(slot: FallingSlot, src: number): boolean {
    slot.sourceWindow.append(src);
    if (slot.sourceWindow.length <= slot.length) return false;
    return monotonicOverWindow(slot, src);
}

function tickValue(slot: FallingSlot, src: number): boolean {
    // Tick revises the head bar; warmup is counted on CLOSED bars, so an
    // unwarmed slot returns false without touching the closed window.
    if (slot.sourceWindow.length <= slot.length) return false;
    return monotonicOverWindow(slot, src);
}

/**
 * `true` when `source` fell on each of the trailing `length` bars — every
 * one of the last `length` consecutive first-differences is strictly
 * negative. A `NaN` anywhere in the window yields `false` (the
 * boolean-series convention shared with `ta.crossunder`).
 *
 * @formula  out[t] = ⋀_{k=1..length} src[t−k+1] < src[t−k]
 * @warmup   length
 * @since 1.8
 * @stable
 * @example
 *     // const down = ta.falling(bar.close, 3);
 */
export function falling(slotId: string, source: ScalarOrSeries, length: number): Series<boolean> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as FallingSlot | undefined;
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
