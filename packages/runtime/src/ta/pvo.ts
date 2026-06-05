// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/pvo.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. Per §9.4 we fold invinite's private EMA
// copies onto the canonical `ta.ema` primitive via three sub-slots
// (`${slotId}/fast`, `${slotId}/slow`, `${slotId}/signal`) — same
// composition pattern as `ta.ppo`.

import type { PvoOpts, PvoResult, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView, makeShiftedSeriesView } from "../seriesView";
import { ema } from "./ema";

const DEFAULT_FAST = 12;
const DEFAULT_SLOW = 26;
const DEFAULT_SIGNAL = 9;

type PvoSlot = {
    readonly result: PvoResult;
    readonly pvoBuf: Float64RingBuffer;
    readonly histBuf: Float64RingBuffer;
    /**
     * Reference to the signal-EMA sub-slot's output ring buffer —
     * captured once at first call so per-offset shifted signal views
     * skip a re-entry into `ema(...)` (which would double-advance the
     * sub-slot's compute). Same pattern as `ppo.ts` / `macd.ts`.
     */
    readonly signalBuf: Float64RingBuffer;
    readonly shiftedResults: Map<number, PvoResult>;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.pvo called outside an active script step");
    }
    return ctx;
}

function initSlot(
    capacity: number,
    signalSeries: Series<number>,
    signalBuf: Float64RingBuffer,
): PvoSlot {
    const pvoBuf = new Float64RingBuffer(capacity);
    const histBuf = new Float64RingBuffer(capacity);
    return {
        result: Object.freeze({
            pvo: makeSeriesView<number>(pvoBuf),
            signal: signalSeries,
            hist: makeSeriesView<number>(histBuf),
        }),
        pvoBuf,
        histBuf,
        signalBuf,
        shiftedResults: new Map(),
    };
}

function resultForOffset(slot: PvoSlot, offset: number): PvoResult {
    if (offset === 0) return slot.result;
    let cached = slot.shiftedResults.get(offset);
    if (cached === undefined) {
        cached = Object.freeze({
            pvo: makeShiftedSeriesView<number>(slot.pvoBuf, offset),
            signal: makeShiftedSeriesView<number>(slot.signalBuf, offset),
            hist: makeShiftedSeriesView<number>(slot.histBuf, offset),
        });
        slot.shiftedResults.set(offset, cached);
    }
    return cached;
}

function pvoValue(fast: number, slow: number): number {
    if (!Number.isFinite(fast) || !Number.isFinite(slow) || slow === 0) return Number.NaN;
    return (100 * (fast - slow)) / slow;
}

/**
 * Percentage Volume Oscillator — MACD shape applied to `bar.volume`
 * and normalised by the slow EMA so the histogram + lines are
 * scale-invariant across symbols. Composes three `ta.ema` sub-slots
 * (`${slotId}/fast`, `${slotId}/slow`, `${slotId}/signal`); a fix to
 * `ta.ema` flows in for free. Multi-output: `{ pvo, signal, hist }`.
 * The registry records `primarySeriesKey: "pvo"`,
 * `visibleSeriesKeys: ["pvo", "signal", "hist"]`, and `yDomain: {
 * kind: "auto" }` via `TA_REGISTRY_METADATA`.
 *
 * Defaults `{ fastLength: 12, slowLength: 26, signalLength: 9 }`
 * (Appel-era — matches MACD / PPO). `slow === 0` (no volume in the
 * slow window) emits NaN on the PVO line, which propagates to hist;
 * signal can still be defined off prior PVO values.
 *
 * @formula  fast   = ema(volume, fastLength) ;
 *           slow   = ema(volume, slowLength) ;
 *           pvo    = 100 · (fast − slow) / slow ; NaN if slow === 0 ;
 *           signal = ema(pvo, signalLength) ;
 *           hist   = pvo − signal
 * @warmup   slowLength + signalLength − 2
 * @since 0.2
 * @experimental
 *
 * `opts.offset` shifts all three outputs in lockstep (PLAN.md §9.1).
 *
 * @example
 *     // import { ta, plot } from "@invinite-org/chartlang-runtime";
 *     // const p = ta.pvo("slot");
 *     // plot(p.pvo); plot(p.signal); plot(p.hist);
 */
export function pvo(slotId: string, opts?: PvoOpts): PvoResult {
    const ctx = getCtx();
    const fastLength = opts?.fastLength ?? DEFAULT_FAST;
    const slowLength = opts?.slowLength ?? DEFAULT_SLOW;
    const signalLength = opts?.signalLength ?? DEFAULT_SIGNAL;
    const offset = opts?.offset ?? 0;
    const signalSlotId = `${slotId}/signal`;
    const volume = ctx.stream.bar.volume;
    const fastSeries = ema(`${slotId}/fast`, volume, fastLength);
    const slowSeries = ema(`${slotId}/slow`, volume, slowLength);
    const pv = pvoValue(fastSeries.current, slowSeries.current);
    const signalSeries = ema(signalSlotId, pv, signalLength);

    let slot = ctx.stream.taSlots.get(slotId) as PvoSlot | undefined;
    if (slot === undefined) {
        const emaSlot = ctx.stream.taSlots.get(signalSlotId) as { outBuffer: Float64RingBuffer };
        slot = initSlot(ctx.stream.ohlcv.close.capacity, signalSeries, emaSlot.outBuffer);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const sig = signalSeries.current;
    const histValue = Number.isFinite(pv) && Number.isFinite(sig) ? pv - sig : Number.NaN;
    if (ctx.isTick) {
        slot.pvoBuf.replaceHead(pv);
        slot.histBuf.replaceHead(histValue);
    } else {
        slot.pvoBuf.append(pv);
        slot.histBuf.append(histValue);
    }
    return resultForOffset(slot, offset);
}
