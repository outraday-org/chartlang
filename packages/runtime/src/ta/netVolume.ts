// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/net-volume.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. The math is identical to `ta.obv`; both
// primitives exist in invinite under their own names, so the
// chartlang surface mirrors the public API for naming parity. See
// `obv.ts` for the canonical commentary on `fold`, snapshot fields,
// and NaN handling — this file repeats the shape verbatim under its
// own slot type so each primitive has its own per-callsite state.

import type { NetVolumeOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView, makeShiftedSeriesView } from "../seriesView";

type NetVolumeSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly shiftedViews: Map<number, Series<number>>;
    cumNetVol: number;
    prevClose: number;
    prevClosedCumNetVol: number;
    prevClosedPrevClose: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.netVolume called outside an active script step");
    }
    return ctx;
}

function initSlot(capacity: number): NetVolumeSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        shiftedViews: new Map(),
        cumNetVol: 0,
        prevClose: Number.NaN,
        prevClosedCumNetVol: 0,
        prevClosedPrevClose: Number.NaN,
    };
}

function viewForOffset(slot: NetVolumeSlot, offset: number): Series<number> {
    if (offset === 0) return slot.series;
    let view = slot.shiftedViews.get(offset);
    if (view === undefined) {
        view = makeShiftedSeriesView<number>(slot.outBuffer, offset);
        slot.shiftedViews.set(offset, view);
    }
    return view;
}

function signOfDelta(delta: number): number {
    if (delta > 0) return 1;
    if (delta < 0) return -1;
    return 0;
}

function fold(
    inCum: number,
    inPrevClose: number,
    close: number,
    volume: number,
): { cum: number; prevClose: number } {
    if (!Number.isFinite(close)) {
        return { cum: inCum, prevClose: inPrevClose };
    }
    if (!Number.isFinite(inPrevClose)) {
        return { cum: inCum, prevClose: close };
    }
    if (!Number.isFinite(volume)) {
        return { cum: inCum, prevClose: close };
    }
    const direction = signOfDelta(close - inPrevClose);
    return { cum: inCum + direction * volume, prevClose: close };
}

/**
 * Net Volume — cumulative `sign(close − prevClose) · volume`. **The
 * math is identical to `ta.obv`** (both primitives ship in invinite
 * under their own names; chartlang mirrors the public surface for
 * naming parity). Prefer `ta.obv` when writing new scripts — this
 * primitive exists to satisfy translation of Pine / invinite
 * indicators that call `netVolume()` directly. The cross-equivalence
 * is property-tested (`netVolume.property.test.ts`).
 *
 * First bar emits `0` (no prior close to difference against — Pine
 * convention). NaN volume carries the accumulator forward without an
 * update; NaN close holds `prevClose` at its prior value.
 *
 * **Tick mode.** Replays the head bar's contribution against a
 * snapshot of the prior-close `(cumNetVol, prevClose)` tuple.
 *
 * @formula  netVolume[t] = netVolume[t − 1] + sign(close[t] − close[t − 1]) · volume[t]
 * @warmup   1 (needs a prior close to compute the delta; bar 0 emits 0)
 * @since 0.2
 * @experimental
 *
 * `opts.offset` shifts the returned series (PLAN.md §9.1).
 *
 * @example
 *     // import { ta, plot } from "@invinite-org/chartlang-core";
 *     // const nv = ta.netVolume();
 *     // plot(nv);
 */
export function netVolume(slotId: string, opts?: NetVolumeOpts): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as NetVolumeSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const offset = opts?.offset ?? 0;
    const { close, volume } = ctx.stream.bar;

    if (ctx.isTick) {
        const next = fold(slot.prevClosedCumNetVol, slot.prevClosedPrevClose, close, volume);
        slot.outBuffer.replaceHead(next.cum);
        return viewForOffset(slot, offset);
    }

    slot.prevClosedCumNetVol = slot.cumNetVol;
    slot.prevClosedPrevClose = slot.prevClose;
    const next = fold(slot.cumNetVol, slot.prevClose, close, volume);
    slot.cumNetVol = next.cum;
    slot.prevClose = next.prevClose;
    slot.outBuffer.append(slot.cumNetVol);
    return viewForOffset(slot, offset);
}
