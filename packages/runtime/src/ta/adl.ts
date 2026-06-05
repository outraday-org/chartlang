// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/adl.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape.

import type { AdlOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView } from "../seriesView";

type AdlSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    /** Active cumulative ADL across the closed bars so far. */
    cumAdl: number;
    /** Snapshot of `cumAdl` BEFORE the most recent close-side update. */
    prevClosedCumAdl: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.adl called outside an active script step");
    }
    return ctx;
}

function initSlot(capacity: number): AdlSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        cumAdl: 0,
        prevClosedCumAdl: 0,
    };
}

/**
 * Per-bar Money-Flow Volume: CLV (close location value) `((close − low)
 * − (high − close)) / (high − low)` multiplied by volume. Returns 0
 * on a zero-range bar (matches invinite's defensive guard) and 0 on
 * any NaN OHLC / volume (matches `safeVolume(NaN) === 0`). The
 * cumulative accumulator stays well-defined across data gaps.
 */
function mfvAt(close: number, high: number, low: number, volume: number): number {
    if (
        !Number.isFinite(close) ||
        !Number.isFinite(high) ||
        !Number.isFinite(low) ||
        !Number.isFinite(volume)
    ) {
        return 0;
    }
    const range = high - low;
    if (range === 0) return 0;
    const clv = (close - low - (high - close)) / range;
    return clv * volume;
}

/**
 * Accumulation Distribution Line — cumulative money-flow volume
 * `Σ CLV · volume`, where CLV is the close location value
 * `((C − L) − (H − C)) / (H − L)`. Zero-range bars (`high === low`)
 * contribute 0 (matches invinite's guard); NaN OHLC / volume bars
 * contribute 0 (carry the accumulator forward without polluting it).
 *
 * Renders in its own pane (volume category). No warmup — every slot
 * finite from bar 0.
 *
 * **Tick mode.** Replays the head bar's contribution against a
 * snapshot of the prior-close `cumAdl` so a partial-bar tick doesn't
 * pollute the next close's accumulator.
 *
 * @formula  adl[t] = adl[t − 1] + ((C[t] − L[t]) − (H[t] − C[t])) / (H[t] − L[t]) · V[t]
 * @warmup   0
 * @since 0.2
 * @experimental
 *
 * @example
 *     // import { ta, plot } from "@invinite-org/chartlang-core";
 *     // const a = ta.adl();
 *     // plot(a);
 */
export function adl(slotId: string, _opts?: AdlOpts): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as AdlSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const { close, high, low, volume } = ctx.stream.bar;
    const mfv = mfvAt(close, high, low, volume);

    if (ctx.isTick) {
        slot.outBuffer.replaceHead(slot.prevClosedCumAdl + mfv);
        return slot.series;
    }

    slot.prevClosedCumAdl = slot.cumAdl;
    slot.cumAdl += mfv;
    slot.outBuffer.append(slot.cumAdl);
    return slot.series;
}
