// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/pvi.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. Mirror of `nvi.ts` — same recurrence, the
// only difference is the volume-comparison predicate (`>` vs `<`).
// Kept as parallel files (rather than a shared helper) so each
// primitive has its own slot type + JSDoc + per-callsite tests.

import type { PviOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView, makeShiftedSeriesView } from "../seriesView.js";

/**
 * Anchored seed value at bar 0 (and after any bar where the
 * accumulator has been carried-forward through NaN inputs).
 *
 * @anchors seedValue
 */
const SEED_VALUE = 1000;

type PviSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly shiftedViews: Map<number, Series<number>>;
    value: number;
    prevClose: number;
    prevVolume: number;
    prevClosedValue: number;
    prevClosedPrevClose: number;
    prevClosedPrevVolume: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.pvi called outside an active script step");
    }
    return ctx;
}

function initSlot(capacity: number): PviSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        shiftedViews: new Map(),
        value: SEED_VALUE,
        prevClose: Number.NaN,
        prevVolume: Number.NaN,
        prevClosedValue: SEED_VALUE,
        prevClosedPrevClose: Number.NaN,
        prevClosedPrevVolume: Number.NaN,
    };
}

function viewForOffset(slot: PviSlot, offset: number): Series<number> {
    if (offset === 0) return slot.series;
    let view = slot.shiftedViews.get(offset);
    if (view === undefined) {
        view = makeShiftedSeriesView<number>(slot.outBuffer, offset);
        slot.shiftedViews.set(offset, view);
    }
    return view;
}

function safeVol(volume: number): number {
    return Number.isFinite(volume) ? volume : 0;
}

function fold(
    inValue: number,
    inPrevClose: number,
    inPrevVolume: number,
    close: number,
    volume: number,
): { value: number; prevClose: number; prevVolume: number } {
    if (!Number.isFinite(close)) {
        return { value: inValue, prevClose: inPrevClose, prevVolume: inPrevVolume };
    }
    const v = safeVol(volume);
    if (!Number.isFinite(inPrevClose)) {
        return { value: inValue, prevClose: close, prevVolume: v };
    }
    const pv = safeVol(inPrevVolume);
    const shouldUpdate = v > pv;
    if (!shouldUpdate || inPrevClose === 0) {
        return { value: inValue, prevClose: close, prevVolume: v };
    }
    const next = inValue * (1 + (close - inPrevClose) / inPrevClose);
    return { value: next, prevClose: close, prevVolume: v };
}

/**
 * Positive Volume Index — mirror of {@link nvi}. Cumulative percentage-
 * change in close on bars whose volume is strictly HIGHER than the
 * prior bar's; bars with equal-or-lower volume carry the prior PVI
 * value unchanged. Seeded at 1000.
 *
 * NaN volume is treated as 0 (matches invinite's `safeVolume` shape);
 * NaN close carries the accumulator forward without advancing
 * `prevClose`.
 *
 * **Tick mode.** Replays the head bar's contribution against a
 * snapshot of the prior-close `(value, prevClose, prevVolume)` tuple.
 *
 * @formula  pvi[0] = 1000 ;
 *           pvi[t] = (volume[t] > volume[t − 1] && prevClose != 0)
 *                  ? pvi[t − 1] · (1 + (close[t] − close[t − 1]) / close[t − 1])
 *                  : pvi[t − 1]
 * @warmup   1 (bar 0 emits the 1000 seed)
 * @anchors  seedValue
 * @since 0.2
 * @stable
 *
 * `opts.offset` shifts the returned series (PLAN.md §9.1).
 *
 * @example
 *     // import { ta, plot } from "@invinite-org/chartlang-core";
 *     // const p = ta.pvi();
 *     // plot(p);
 */
export function pvi(slotId: string, opts?: PviOpts): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as PviSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const offset = opts?.offset ?? 0;
    const { close, volume } = ctx.stream.bar;

    if (ctx.isTick) {
        const next = fold(
            slot.prevClosedValue,
            slot.prevClosedPrevClose,
            slot.prevClosedPrevVolume,
            close,
            volume,
        );
        slot.outBuffer.replaceHead(next.value);
        return viewForOffset(slot, offset);
    }

    slot.prevClosedValue = slot.value;
    slot.prevClosedPrevClose = slot.prevClose;
    slot.prevClosedPrevVolume = slot.prevVolume;
    const next = fold(slot.value, slot.prevClose, slot.prevVolume, close, volume);
    slot.value = next.value;
    slot.prevClose = next.prevClose;
    slot.prevVolume = next.prevVolume;
    slot.outBuffer.append(slot.value);
    return viewForOffset(slot, offset);
}
