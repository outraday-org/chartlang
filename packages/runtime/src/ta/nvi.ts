// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/nvi.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. The runtime emits the RAW NVI line only;
// invinite's optional smoothing block is left to the script author
// (`ta.ema(ta.nvi(), 255)` etc.). The mirror primitive `ta.pvi`
// re-uses this file's `nviLikeFold` shape with a flipped predicate.

import type { NviOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView, makeShiftedSeriesView } from "../seriesView";

/**
 * Anchored seed value at bar 0 (and after any bar where the
 * accumulator has been carried-forward through NaN inputs).
 *
 * @anchors seedValue
 */
const SEED_VALUE = 1000;

type NviSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly shiftedViews: Map<number, Series<number>>;
    /** Active NVI value across the closed bars so far. */
    value: number;
    /** Most recent finite close. */
    prevClose: number;
    /** Most recent volume (treated as 0 on NaN). */
    prevVolume: number;
    /** Snapshot of `value` BEFORE the most recent close-side update. */
    prevClosedValue: number;
    prevClosedPrevClose: number;
    prevClosedPrevVolume: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.nvi called outside an active script step");
    }
    return ctx;
}

function initSlot(capacity: number): NviSlot {
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

function viewForOffset(slot: NviSlot, offset: number): Series<number> {
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

/**
 * Fold the bar's `(close, volume)` into the prior NVI state. NaN close
 * carries every field forward (don't advance `prevClose` — the next
 * finite close differences against the last finite one). NaN volume
 * is treated as 0 (matches invinite's `safeVolume` shape). The
 * comparison runs `currV < prevV` (NVI) and only updates when the
 * comparison holds AND `prevClose !== 0`.
 */
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
        // First defined close — seed `prevClose` + `prevVolume`,
        // leave `value` at its 1000 seed.
        return { value: inValue, prevClose: close, prevVolume: v };
    }
    const pv = safeVol(inPrevVolume);
    const shouldUpdate = v < pv;
    if (!shouldUpdate || inPrevClose === 0) {
        return { value: inValue, prevClose: close, prevVolume: v };
    }
    const next = inValue * (1 + (close - inPrevClose) / inPrevClose);
    return { value: next, prevClose: close, prevVolume: v };
}

/**
 * Negative Volume Index — cumulative percentage-change in close on
 * bars whose volume is strictly LOWER than the prior bar's; bars with
 * equal-or-higher volume carry the prior NVI value unchanged. Seeded
 * at 1000 (anchor — see `SEED_VALUE`); the property tests pin the
 * seed at bar 0.
 *
 * NaN volume is treated as 0 (matches invinite's `safeVolume` shape) —
 * a NaN-volume bar is "lower" than any positive-volume bar, so the
 * comparison is exercised. NaN close carries every accumulator field
 * forward without advancing — the next finite close differences
 * against the last finite one.
 *
 * **Tick mode.** Replays the head bar's contribution against a
 * snapshot of the prior-close `(value, prevClose, prevVolume)` tuple.
 *
 * @formula  nvi[0] = 1000 ;
 *           nvi[t] = (volume[t] < volume[t − 1] && prevClose != 0)
 *                  ? nvi[t − 1] · (1 + (close[t] − close[t − 1]) / close[t − 1])
 *                  : nvi[t − 1]
 * @warmup   1 (bar 0 emits the 1000 seed)
 * @anchors  seedValue
 * @since 0.2
 * @stable
 *
 * `opts.offset` shifts the returned series (PLAN.md §9.1).
 *
 * @example
 *     // import { ta, plot } from "@invinite-org/chartlang-core";
 *     // const n = ta.nvi();
 *     // plot(n);
 */
export function nvi(slotId: string, opts?: NviOpts): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as NviSlot | undefined;
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
