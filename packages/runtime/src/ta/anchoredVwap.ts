// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/anchored-vwap.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape.

import type { AnchoredVwapOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView } from "../seriesView";

type AnchoredVwapSource = NonNullable<AnchoredVwapOpts["source"]>;

const DEFAULT_SOURCE: AnchoredVwapSource = "hlc3";

type AnchoredVwapSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    /** Sticky anchor — captured on slot init, ignored on subsequent calls. */
    readonly anchorTime: number;
    /** Active cumulative price·volume since the first bar ≥ anchorTime. */
    cumPV: number;
    /** Active cumulative volume since the first bar ≥ anchorTime. */
    cumV: number;
    /** True once a bar with `time ≥ anchorTime` has closed. */
    started: boolean;
    /** Snapshot of `cumPV` BEFORE the most recent close-side update. */
    prevClosedCumPV: number;
    /** Snapshot of `cumV` BEFORE the most recent close-side update. */
    prevClosedCumV: number;
    /** Snapshot of `started` BEFORE the most recent close-side update. */
    prevClosedStarted: boolean;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.anchoredVwap called outside an active script step");
    }
    return ctx;
}

function initSlot(capacity: number, anchorTime: number): AnchoredVwapSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        anchorTime,
        cumPV: 0,
        cumV: 0,
        started: false,
        prevClosedCumPV: 0,
        prevClosedCumV: 0,
        prevClosedStarted: false,
    };
}

function readSource(ctx: RuntimeContext, source: AnchoredVwapSource): number {
    switch (source) {
        case "close":
            return ctx.stream.bar.close;
        case "hl2":
            return ctx.stream.bar.hl2;
        case "hlc3":
            return ctx.stream.bar.hlc3;
        case "ohlc4":
            return ctx.stream.bar.ohlc4;
        case "hlcc4":
            return ctx.stream.bar.hlcc4;
    }
}

/**
 * Fold one bar against an accumulator. Returns the post-fold tuple.
 * Bars with `time < anchor` are skipped (the accumulator is unchanged,
 * `started` stays false). NaN source or non-positive / NaN volume
 * contributes zero — the accumulator stays well-defined across data
 * gaps.
 */
function fold(
    inCumPV: number,
    inCumV: number,
    inStarted: boolean,
    anchorTime: number,
    time: number,
    src: number,
    volume: number,
): { cumPV: number; cumV: number; started: boolean } {
    if (time < anchorTime) {
        return { cumPV: inCumPV, cumV: inCumV, started: inStarted };
    }
    let cumPV = inCumPV;
    let cumV = inCumV;
    if (Number.isFinite(src) && Number.isFinite(volume) && volume > 0) {
        cumPV += src * volume;
        cumV += volume;
    }
    return { cumPV, cumV, started: true };
}

function valueFromCum(started: boolean, cumPV: number, cumV: number): number {
    if (!started || cumV === 0) return Number.NaN;
    return cumPV / cumV;
}

/**
 * Anchored Volume-Weighted Average Price — accumulates
 * `Σ(source · volume) / Σ(volume)` over every bar at or after
 * `anchorTime` (a UTC millisecond epoch the script author hard-codes
 * or computes from a literal). Bars with `bar.time < anchorTime` emit
 * `NaN`; the first bar with `bar.time ≥ anchorTime` starts the
 * accumulation, which never resets.
 *
 * **Sticky anchor.** The anchor is captured on the first call (slot
 * init) and ignored on subsequent calls — the slot's anchor is
 * sticky. Re-anchoring requires a new compiler-generated callsite id
 * (i.e. editing the script). Phase 4's `input.time()` will lift the
 * anchor to a user input that can change at runtime.
 *
 * **NaN handling.** NaN source or non-positive / NaN volume
 * contributes zero (the average stays well-defined across data gaps).
 * Bars before `anchorTime` or before any volume has accumulated emit
 * NaN.
 *
 * **Tick mode.** Replays the head bar's contribution against a
 * snapshot of the prior-close `(cumPV, cumV, started)` tuple so a
 * partial-bar tick doesn't pollute the next close's accumulator.
 *
 * @formula  anchoredVwap[t] = Σ_{u ≥ anchor}(source[u] · volume[u]) / Σ_{u ≥ anchor}(volume[u])
 * @warmup   0 (NaN until first bar with `bar.time ≥ anchorTime`)
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const av = ta.anchoredVwap("slot", 1_700_000_000_000);
 *     // const head = av.current;
 */
export function anchoredVwap(
    slotId: string,
    anchorTime: number,
    opts?: AnchoredVwapOpts,
): Series<number> {
    const ctx = getCtx();
    const source = opts?.source ?? DEFAULT_SOURCE;
    let slot = ctx.stream.taSlots.get(slotId) as AnchoredVwapSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(ctx.stream.ohlcv.close.capacity, anchorTime);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const src = readSource(ctx, source);
    const volume = ctx.stream.bar.volume;
    const time = ctx.stream.bar.time;

    if (ctx.isTick) {
        const next = fold(
            slot.prevClosedCumPV,
            slot.prevClosedCumV,
            slot.prevClosedStarted,
            slot.anchorTime,
            time,
            src,
            volume,
        );
        slot.outBuffer.replaceHead(valueFromCum(next.started, next.cumPV, next.cumV));
        return slot.series;
    }

    // Close-side: snapshot the prior-close state, then fold in the new bar.
    slot.prevClosedCumPV = slot.cumPV;
    slot.prevClosedCumV = slot.cumV;
    slot.prevClosedStarted = slot.started;
    const next = fold(slot.cumPV, slot.cumV, slot.started, slot.anchorTime, time, src, volume);
    slot.cumPV = next.cumPV;
    slot.cumV = next.cumV;
    slot.started = next.started;
    slot.outBuffer.append(valueFromCum(slot.started, slot.cumPV, slot.cumV));
    return slot.series;
}
