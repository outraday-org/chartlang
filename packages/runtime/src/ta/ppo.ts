// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/ppo.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. Per §9.4 we fold invinite's private EMA copy
// onto the canonical `ta.ema` primitive via three sub-slots
// (`${slotId}/fast`, `${slotId}/slow`, `${slotId}/signal`) — same
// composition pattern as `ta.macd`.

import type { PpoOpts, PpoResult, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView, makeShiftedSeriesView } from "../seriesView";
import { ema } from "./ema";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue";

const DEFAULT_FAST = 12;
const DEFAULT_SLOW = 26;
const DEFAULT_SIGNAL = 9;

type PpoSlot = {
    readonly result: PpoResult;
    readonly ppoBuf: Float64RingBuffer;
    readonly histBuf: Float64RingBuffer;
    /**
     * Reference to the signal-EMA sub-slot's output ring buffer.
     * Captured at first call so per-offset shifted signal views can be
     * constructed without re-entering `ema()` (which would double-
     * advance the sub-slot's compute on every bar). Same pattern as
     * `macd.ts`.
     */
    readonly signalBuf: Float64RingBuffer;
    /** Per-offset frozen `PpoResult` cache (identity-preserving for `offset === 0`). */
    readonly shiftedResults: Map<number, PpoResult>;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.ppo called outside an active script step");
    }
    return ctx;
}

function initSlot(
    capacity: number,
    signalSeries: Series<number>,
    signalBuf: Float64RingBuffer,
): PpoSlot {
    const ppoBuf = new Float64RingBuffer(capacity);
    const histBuf = new Float64RingBuffer(capacity);
    return {
        result: Object.freeze({
            ppo: makeSeriesView<number>(ppoBuf),
            signal: signalSeries,
            hist: makeSeriesView<number>(histBuf),
        }),
        ppoBuf,
        histBuf,
        signalBuf,
        shiftedResults: new Map(),
    };
}

function resultForOffset(slot: PpoSlot, offset: number): PpoResult {
    if (offset === 0) return slot.result;
    let cached = slot.shiftedResults.get(offset);
    if (cached === undefined) {
        cached = Object.freeze({
            ppo: makeShiftedSeriesView<number>(slot.ppoBuf, offset),
            signal: makeShiftedSeriesView<number>(slot.signalBuf, offset),
            hist: makeShiftedSeriesView<number>(slot.histBuf, offset),
        });
        slot.shiftedResults.set(offset, cached);
    }
    return cached;
}

function ppoValue(fast: number, slow: number): number {
    if (!Number.isFinite(fast) || !Number.isFinite(slow) || slow === 0) return Number.NaN;
    return (100 * (fast - slow)) / slow;
}

/**
 * Percentage Price Oscillator — same shape as MACD but normalised by
 * the slow EMA so the histogram + lines are scale-invariant across
 * symbols. Composes three `ta.ema` sub-slots (`${slotId}/fast`,
 * `${slotId}/slow`, `${slotId}/signal`); a fix to `ema` flows into
 * PPO for free. Multi-output: `{ ppo, signal, hist }`. The registry
 * records `primarySeriesKey: "ppo"`, `visibleSeriesKeys: ["ppo",
 * "signal", "hist"]`, and `yDomain: { kind: "auto" }` via
 * `TA_REGISTRY_METADATA`.
 *
 * Defaults `{ fastLength: 12, slowLength: 26, signalLength: 9 }`
 * (Appel-era — matches MACD). `slow === 0` (degenerate price stream)
 * emits `NaN` at the PPO line, which propagates to hist; signal can
 * still be defined off prior PPO values.
 *
 * @formula  fast   = ema(source, fastLength) ;
 *           slow   = ema(source, slowLength) ;
 *           ppo    = 100 · (fast − slow) / slow ; NaN if slow === 0 ;
 *           signal = ema(ppo, signalLength) ;
 *           hist   = ppo − signal
 * @warmup   slowLength + signalLength − 2
 * @since 0.2
 * @stable
 *
 * `opts.offset` shifts all three outputs in lockstep (PLAN.md §9.1) —
 * `series.current` on each output returns the value `offset` bars ago.
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const p = ta.ppo("slot", bar.close);
 *     // const head = p.hist.current;
 *     // const lagged = ta.ppo("slot2", bar.close, { offset: 5 });
 */
export function ppo(slotId: string, source: ScalarOrSeries, opts?: PpoOpts): PpoResult {
    const ctx = getCtx();
    const fastLength = opts?.fastLength ?? DEFAULT_FAST;
    const slowLength = opts?.slowLength ?? DEFAULT_SLOW;
    const signalLength = opts?.signalLength ?? DEFAULT_SIGNAL;
    const offset = opts?.offset ?? 0;
    const signalSlotId = `${slotId}/signal`;
    const src = readSourceValue(source);
    const fastSeries = ema(`${slotId}/fast`, src, fastLength);
    const slowSeries = ema(`${slotId}/slow`, src, slowLength);
    const pv = ppoValue(fastSeries.current, slowSeries.current);
    // Feed PPO scalar into the signal EMA. Always call with the
    // un-shifted (default) view — offset shifting for the composite
    // PpoResult happens via `resultForOffset`, which reads directly off
    // the signal-EMA's outBuffer (captured below).
    const signalSeries = ema(signalSlotId, pv, signalLength);

    let slot = ctx.stream.taSlots.get(slotId) as PpoSlot | undefined;
    if (slot === undefined) {
        const emaSlot = ctx.stream.taSlots.get(signalSlotId) as { outBuffer: Float64RingBuffer };
        slot = initSlot(ctx.stream.ohlcv.close.capacity, signalSeries, emaSlot.outBuffer);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const sig = signalSeries.current;
    const histValue = Number.isFinite(pv) && Number.isFinite(sig) ? pv - sig : Number.NaN;
    if (ctx.isTick) {
        slot.ppoBuf.replaceHead(pv);
        slot.histBuf.replaceHead(histValue);
    } else {
        slot.ppoBuf.append(pv);
        slot.histBuf.append(histValue);
    }
    return resultForOffset(slot, offset);
}
