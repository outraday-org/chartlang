// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/tsi.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.

import type { TsiOpts, TsiResult } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView, makeShiftedSeriesView } from "../seriesView";
import { ema } from "./ema";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue";

const DEFAULT_FIRST = 25;
const DEFAULT_SECOND = 13;
const DEFAULT_SIGNAL = 13;

type TsiSlot = {
    readonly result: TsiResult;
    readonly tsiBuf: Float64RingBuffer;
    readonly signalBuf: Float64RingBuffer;
    readonly shiftedResults: Map<number, TsiResult>;
    prevSrc: number;
    prevClosedSrc: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.tsi called outside an active script step");
    }
    return ctx;
}

function resultForOffset(slot: TsiSlot, offset: number): TsiResult {
    if (offset === 0) return slot.result;
    let cached = slot.shiftedResults.get(offset);
    if (cached === undefined) {
        cached = Object.freeze({
            tsi: makeShiftedSeriesView<number>(slot.tsiBuf, offset),
            signal: makeShiftedSeriesView<number>(slot.signalBuf, offset),
        });
        slot.shiftedResults.set(offset, cached);
    }
    return cached;
}

function tsiValue(num: number, den: number): number {
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return Number.NaN;
    return (100 * num) / den;
}

/**
 * True Strength Index (William Blau). Double-EMA-smoothed ratio of
 * one-bar price changes vs their absolute values, scaled ×100. Per
 * TradingView's published formula:
 *
 *   `mom    = source[t] − source[t-1]`
 *   `absMom = |mom|`
 *   `ema1   = EMA(firstSmoothing)(mom)`
 *   `ema2   = EMA(secondSmoothing)(ema1)`
 *   `absEma1 = EMA(firstSmoothing)(absMom)`
 *   `absEma2 = EMA(secondSmoothing)(absEma1)`
 *   `tsi    = 100 × ema2 / absEma2`
 *   `signal = EMA(signalLength)(tsi)`
 *
 * Bounded `[-100, 100]` by construction (when defined). Flat-input
 * windows where `absEma2` collapses to zero emit NaN at `tsi` (and
 * propagate to `signal`). Defaults `(firstSmoothing, secondSmoothing,
 * signalLength) = (25, 13, 13)`.
 *
 * Note: Pine's `ta.tsi()` returns the raw `ema2 / absEma2` ratio
 * (no ×100). chartlang follows TradingView's published TSI study
 * (×100); for the raw ratio, divide by 100.
 *
 * @formula  see above
 * @warmup   firstSmoothing + secondSmoothing + signalLength − 3
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const t = ta.tsi("slot", bar.close);
 *     // plot(t.tsi); plot(t.signal);
 */
export function tsi(slotId: string, source: ScalarOrSeries, opts?: TsiOpts): TsiResult {
    const ctx = getCtx();
    const firstSmoothing = opts?.firstSmoothing ?? DEFAULT_FIRST;
    const secondSmoothing = opts?.secondSmoothing ?? DEFAULT_SECOND;
    const signalLength = opts?.signalLength ?? DEFAULT_SIGNAL;
    const offset = opts?.offset ?? 0;
    const signalSlotId = `${slotId}/signal`;
    const isTick = ctx.isTick;
    const src = readSourceValue(source);

    let slot = ctx.stream.taSlots.get(slotId) as TsiSlot | undefined;
    // The `?? Number.NaN` fallbacks below are defensive: the runner
    // always close-side advances before tick, so `slot` exists by the
    // time `isTick` is true; on close-side the first-bar `slot` is
    // still undefined and we want NaN momentum (no prior bar).
    const prevForDiff = isTick
        ? /* c8 ignore next */ (slot?.prevClosedSrc ?? Number.NaN)
        : (slot?.prevSrc ?? Number.NaN);
    const mom =
        Number.isFinite(src) && Number.isFinite(prevForDiff) ? src - prevForDiff : Number.NaN;
    const absMom = Number.isFinite(mom) ? Math.abs(mom) : Number.NaN;

    const momEma1 = ema(`${slotId}/momEma1`, mom, firstSmoothing).current;
    const momEma2 = ema(`${slotId}/momEma2`, momEma1, secondSmoothing).current;
    const absEma1 = ema(`${slotId}/absMomEma1`, absMom, firstSmoothing).current;
    const absEma2 = ema(`${slotId}/absMomEma2`, absEma1, secondSmoothing).current;
    const tsiOut = tsiValue(momEma2, absEma2);

    const signalSeries = ema(signalSlotId, tsiOut, signalLength);

    if (slot === undefined) {
        const tsiBuf = new Float64RingBuffer(ctx.stream.ohlcv.close.capacity);
        const emaSlot = ctx.stream.taSlots.get(signalSlotId) as {
            outBuffer: Float64RingBuffer;
        };
        slot = {
            result: Object.freeze({
                tsi: makeSeriesView<number>(tsiBuf),
                signal: signalSeries,
            }),
            tsiBuf,
            signalBuf: emaSlot.outBuffer,
            shiftedResults: new Map(),
            prevSrc: src,
            prevClosedSrc: Number.NaN,
        };
        ctx.stream.taSlots.set(slotId, slot);
        slot.tsiBuf.append(tsiOut);
        return resultForOffset(slot, offset);
    }

    if (isTick) {
        slot.tsiBuf.replaceHead(tsiOut);
    } else {
        slot.tsiBuf.append(tsiOut);
        slot.prevClosedSrc = slot.prevSrc;
        slot.prevSrc = src;
    }

    return resultForOffset(slot, offset);
}
