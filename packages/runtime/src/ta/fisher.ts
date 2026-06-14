// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/fisher.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. Composition: `ta.highest` + `ta.lowest`
// sub-slots over `bar.hl2`; the clamp / atanh / EMA-blend recurrence
// is inline (no registry helper expresses Fisher's bespoke α=0.66/0.67
// blend).
//
// DIVERGENCE: invinite clamps `x` to ±0.999 before the `atanh` so the
// transform never diverges. The task spec (§6) overrides this: when
// `|x| ≥ 1` we emit NaN at `fisher` AND hold the recurrence state
// (`prevX` / `prevFisher` carry forward unchanged so the next bar
// continues from the last valid state).

import type { FisherOpts, FisherResult, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView } from "../seriesView.js";
import { highest } from "./highest.js";
import { lowest } from "./lowest.js";

type FisherSlot = {
    result: FisherResult | null;
    readonly fisherBuf: Float64RingBuffer;
    readonly triggerBuf: Float64RingBuffer;
    readonly fisherSeries: Series<number>;
    readonly triggerSeries: Series<number>;
    readonly length: number;
    /** Closed-side state — last bar's contribution applied. */
    prevX: number;
    prevFisher: number;
    /** Snapshot BEFORE the most recent close-side update — used by tick replay. */
    prevClosedX: number;
    prevClosedFisher: number;
    barCount: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.fisher called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, capacity: number): FisherSlot {
    const fisherBuf = new Float64RingBuffer(capacity);
    const triggerBuf = new Float64RingBuffer(capacity);
    return {
        result: null,
        fisherBuf,
        triggerBuf,
        fisherSeries: makeSeriesView<number>(fisherBuf),
        triggerSeries: makeSeriesView<number>(triggerBuf),
        length,
        prevX: 0,
        prevFisher: 0,
        prevClosedX: 0,
        prevClosedFisher: 0,
        barCount: 0,
    };
}

/**
 * Compute `(fisherValue, triggerValue, nextX, nextFisher)` given the
 * normalised mid + the basis `(baseX, baseFisher)` snapshot. The
 * `triggerValue` written is the input `baseFisher` (Fisher's
 * 1-bar-lagged trigger). NaN at `fisher` propagates as a "no-update"
 * to `nextX` / `nextFisher` so the recurrence holds.
 */
function computeStep(
    normalised: number,
    baseX: number,
    baseFisher: number,
): { fisherValue: number; triggerValue: number; nextX: number; nextFisher: number } {
    const x = 0.66 * normalised + 0.67 * baseX;
    // Defensive: normalised ∈ [-0.5, 0.5] means x asymptotes to ±1.0
    // but never crosses under exact arithmetic. Keep the clamp so a
    // pathological floating-point overshoot produces NaN rather than
    // ±Infinity from `ln((1+x)/(1-x))`.
    /* c8 ignore start */
    if (Math.abs(x) >= 1) {
        return {
            fisherValue: Number.NaN,
            triggerValue: baseFisher,
            nextX: baseX,
            nextFisher: baseFisher,
        };
    }
    /* c8 ignore stop */
    const fisherValue = 0.5 * Math.log((1 + x) / (1 - x)) + 0.5 * baseFisher;
    return { fisherValue, triggerValue: baseFisher, nextX: x, nextFisher: fisherValue };
}

/**
 * John Ehlers' Fisher Transform. Normalises the rolling `bar.hl2`
 * midpoint to `[-0.5, 0.5]` over a `length`-bar window, blends with
 * the prior `x` (`0.66·norm + 0.67·prevX`), then applies the Fisher
 * z-transform `0.5·ln((1+x)/(1−x))` with an EMA-style blend against
 * the prior Fisher. Composes `ta.highest` + `ta.lowest` sub-slots over
 * `bar.hl2` (`${slotId}/midHigh` + `${slotId}/midLow`). The clamp /
 * atanh / blend recurrence stays inline (no registry equivalent).
 *
 * The `trigger` output is the prior bar's `fisher` value (1-bar lag);
 * bar 0's `trigger` is NaN. When the recurrence would drive `|x| ≥ 1`
 * (pathological case), emits NaN at `fisher` and holds the recurrence
 * state — diverges from invinite's ±0.999 clamp per task spec.
 *
 * @formula  mid        = (bar.high + bar.low) / 2 ;
 *           normalised = flatRange ? 0 : (mid − ll) / (hh − ll) − 0.5
 *                        where hh = highest(mid, length), ll = lowest(mid, length) ;
 *           x          = 0.66 · normalised + 0.67 · prevX ;
 *           NaN at fisher if |x| ≥ 1 (recurrence held) ;
 *           fisher     = 0.5 · ln((1 + x) / (1 − x)) + 0.5 · prevFisher ;
 *           trigger[t] = prevFisher (the value of fisher before this close)
 * @warmup   length (first defined `fisher` at bar `length - 1`; first defined `trigger` at bar `length`)
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const f = ta.fisher("slot", 9);
 *     // plot(f.fisher); plot(f.trigger);
 */
export function fisher(slotId: string, length: number, _opts?: FisherOpts): FisherResult {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as FisherSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(length, ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }

    const mid = ctx.stream.bar.hl2;
    const hhSeries = highest(`${slotId}/midHigh`, mid, length);
    const llSeries = lowest(`${slotId}/midLow`, mid, length);
    const hh = hhSeries.current;
    const ll = llSeries.current;

    let normalised: number;
    if (!Number.isFinite(mid) || !Number.isFinite(hh) || !Number.isFinite(ll)) {
        normalised = Number.NaN;
    } else if (hh === ll) {
        normalised = 0;
    } else {
        normalised = (mid - ll) / (hh - ll) - 0.5;
    }

    if (ctx.isTick) {
        // Replay against the prevClosed* snapshot — the closed-side
        // (prevX, prevFisher) are unchanged by the tick.
        const step = Number.isFinite(normalised)
            ? computeStep(normalised, slot.prevClosedX, slot.prevClosedFisher)
            : {
                  fisherValue: Number.NaN,
                  triggerValue: slot.prevClosedFisher,
                  nextX: slot.prevClosedX,
                  nextFisher: slot.prevClosedFisher,
              };
        // First-bar trigger is NaN (no prior fisher) — barCount captures
        // the closed-side advances. Defensive: ticks always follow at
        // least one close, so barCount > 0 on this branch.
        const triggerOut =
            /* c8 ignore next */ slot.barCount === 0 ? Number.NaN : step.triggerValue;
        slot.fisherBuf.replaceHead(step.fisherValue);
        slot.triggerBuf.replaceHead(triggerOut);
    } else {
        // Close-side. Snapshot the closed state BEFORE the update so the
        // next tick can replay against (prevClosedX, prevClosedFisher).
        slot.prevClosedX = slot.prevX;
        slot.prevClosedFisher = slot.prevFisher;
        const step = Number.isFinite(normalised)
            ? computeStep(normalised, slot.prevX, slot.prevFisher)
            : {
                  fisherValue: Number.NaN,
                  triggerValue: slot.prevFisher,
                  nextX: slot.prevX,
                  nextFisher: slot.prevFisher,
              };
        const triggerOut = slot.barCount === 0 ? Number.NaN : step.triggerValue;
        slot.fisherBuf.append(step.fisherValue);
        slot.triggerBuf.append(triggerOut);
        slot.prevX = step.nextX;
        slot.prevFisher = step.nextFisher;
        slot.barCount += 1;
    }

    if (slot.result === null) {
        slot.result = Object.freeze({
            fisher: slot.fisherSeries,
            trigger: slot.triggerSeries,
        });
    }
    return slot.result;
}
