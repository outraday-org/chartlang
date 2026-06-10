// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/kama.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape.

import type { KamaOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView } from "../seriesView.js";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue.js";

const DEFAULT_LENGTH = 10;
const DEFAULT_FAST = 2;
const DEFAULT_SLOW = 30;

type KamaSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly length: number;
    readonly fastAlpha: number;
    readonly slowAlpha: number;
    /** Trailing `length + 1` source values; `at(0)` is head, `at(length)` is oldest. */
    readonly sourceWindow: Float64RingBuffer;
    prevKama: number;
    prevClosedKama: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.kama called outside an active script step");
    }
    return ctx;
}

function initSlot(
    length: number,
    fastLength: number,
    slowLength: number,
    capacity: number,
): KamaSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        length,
        fastAlpha: 2 / (fastLength + 1),
        slowAlpha: 2 / (slowLength + 1),
        sourceWindow: new Float64RingBuffer(length + 1),
        prevKama: Number.NaN,
        prevClosedKama: Number.NaN,
    };
}

/**
 * Compute the next KAMA value given the slot's current window state,
 * `headSrc` (the source value to evaluate at age 0 — may be the
 * just-appended close or a tick replacement), and `prev` (the prior
 * KAMA — either `prevClosedKama` on close or `prevClosedKama` on
 * tick; tick recomputes from the closed prior). Returns NaN until the
 * window holds `length + 1` finite samples.
 */
function computeKama(slot: KamaSlot, headSrc: number, prev: number): number {
    if (slot.sourceWindow.length < slot.length + 1) return Number.NaN;
    if (!Number.isFinite(headSrc)) return prev;

    const oldest = slot.sourceWindow.at(slot.length);
    if (!Number.isFinite(oldest)) return prev;

    const change = Math.abs(headSrc - oldest);

    let volatility = 0;
    // Per-bar absolute diffs across the trailing `length` pairs:
    // |w[0] − w[1]| + |w[1] − w[2]| + … + |w[length-1] − w[length]|
    // with w[0] substituted by `headSrc` so tick replays work
    // without mutating the closed window.
    {
        const next = headSrc;
        const prior = slot.sourceWindow.at(1);
        if (!Number.isFinite(prior)) return prev;
        volatility += Math.abs(next - prior);
    }
    for (let j = 1; j < slot.length; j += 1) {
        const next = slot.sourceWindow.at(j);
        const prior = slot.sourceWindow.at(j + 1);
        if (!Number.isFinite(next) || !Number.isFinite(prior)) return prev;
        volatility += Math.abs(next - prior);
    }

    const er = volatility > 0 ? change / volatility : 0;
    const sc = (er * (slot.fastAlpha - slot.slowAlpha) + slot.slowAlpha) ** 2;

    // Seed at the warmup boundary with the source value itself
    // (matches invinite's convention + standard Pine `ta.kama`).
    if (!Number.isFinite(prev)) return headSrc;
    return prev + sc * (headSrc - prev);
}

/**
 * Kaufman's Adaptive Moving Average — an EMA-like recurrence whose
 * smoothing constant adapts to market efficiency. The "efficiency
 * ratio" is the directional change over the last `length` bars
 * divided by the total path-length over the same window; high
 * efficiency (trending) → smoothing approaches `fastAlpha`,
 * low efficiency (chop) → smoothing approaches `slowAlpha`.
 * Defaults: `length = 10`, `fastLength = 2`, `slowLength = 30`.
 *
 * NaN handling: mid-stream NaN source → KAMA carries the prior value
 * forward (matches the EMA / SMMA recurrence convention). Zero-
 * volatility window → `er = 0`, smoothing degenerates to `slowAlpha²`
 * but no change occurs because `src − prev` is itself 0 in the
 * constant-source regime.
 *
 * @formula  fastAlpha = 2 / (fastLength + 1) ;
 *           slowAlpha = 2 / (slowLength + 1) ;
 *           change   = |src[t] − src[t − length]| ;
 *           vol      = Σ_{j=0..length-1} |src[t − j] − src[t − j − 1]| ;
 *           er       = vol > 0 ? change / vol : 0 ;
 *           sc       = (er · (fastAlpha − slowAlpha) + slowAlpha)² ;
 *           KAMA[t]  = KAMA[t − 1] + sc · (src[t] − KAMA[t − 1])
 * @warmup   length
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const k = ta.kama(bar.close, { length: 10, fastLength: 2, slowLength: 30 });
 *     // plot(k);
 */
export function kama(slotId: string, source: ScalarOrSeries, opts?: KamaOpts): Series<number> {
    const ctx = getCtx();
    const length = opts?.length ?? DEFAULT_LENGTH;
    const fastLength = opts?.fastLength ?? DEFAULT_FAST;
    const slowLength = opts?.slowLength ?? DEFAULT_SLOW;
    let slot = ctx.stream.taSlots.get(slotId) as KamaSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(length, fastLength, slowLength, ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const src = readSourceValue(source);
    if (ctx.isTick) {
        // Tick replays the head off the existing closed window with
        // `src` substituted at age 0; `prevClosedKama` is the recurrence
        // anchor (the prior CLOSED bar's KAMA).
        const value = computeKama(slot, src, slot.prevClosedKama);
        slot.prevKama = Number.isFinite(value) ? value : slot.prevClosedKama;
        slot.outBuffer.replaceHead(value);
    } else {
        slot.sourceWindow.append(src);
        const value = computeKama(slot, src, slot.prevClosedKama);
        slot.prevClosedKama = Number.isFinite(value) ? value : slot.prevClosedKama;
        slot.prevKama = slot.prevClosedKama;
        slot.outBuffer.append(value);
    }
    return slot.series;
}
