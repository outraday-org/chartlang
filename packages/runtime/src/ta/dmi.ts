// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/dmi.ts
//   plus lib/wilder-directional.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. DMI reads `bar.high` / `bar.low` / `bar.close`
// directly (mirrors Pine's `ta.dmi(length)` which has no source param)
// and runs the Wilder +DM / -DM / TR smoothing incrementally via
// `wilderStep` (the same per-step recurrence the reference
// `lib/wilderDirectional.ts` uses internally).

import type { DmiOpts, DmiResult } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView, makeShiftedSeriesView } from "../seriesView";
import {
    advanceDirectionalClose,
    type DirectionalState,
    initDirectionalState,
    tickDirectional,
} from "./lib/directionalState";

type DmiSlot = {
    readonly result: DmiResult;
    readonly plusDiBuffer: Float64RingBuffer;
    readonly minusDiBuffer: Float64RingBuffer;
    readonly dirState: DirectionalState;
    /**
     * Per-offset frozen `DmiResult` cache. `offset === 0` returns
     * `result` by identity. Non-zero offsets get a frozen result
     * whose two Series are `makeShiftedSeriesView` proxies over the
     * same two underlying ring buffers.
     */
    readonly shiftedResults: Map<number, DmiResult>;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.dmi called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, capacity: number): DmiSlot {
    const plusDiBuffer = new Float64RingBuffer(capacity);
    const minusDiBuffer = new Float64RingBuffer(capacity);
    return {
        result: Object.freeze({
            plusDi: makeSeriesView<number>(plusDiBuffer),
            minusDi: makeSeriesView<number>(minusDiBuffer),
        }),
        plusDiBuffer,
        minusDiBuffer,
        dirState: initDirectionalState(length),
        shiftedResults: new Map(),
    };
}

function resultForOffset(slot: DmiSlot, offset: number): DmiResult {
    if (offset === 0) return slot.result;
    let cached = slot.shiftedResults.get(offset);
    if (cached === undefined) {
        cached = Object.freeze({
            plusDi: makeShiftedSeriesView<number>(slot.plusDiBuffer, offset),
            minusDi: makeShiftedSeriesView<number>(slot.minusDiBuffer, offset),
        });
        slot.shiftedResults.set(offset, cached);
    }
    return cached;
}

/**
 * Wilder's Directional Movement Index — `+DI` / `−DI` pair derived
 * from the Wilder-smoothed `+DM` / `−DM` over the smoothed True
 * Range. Reads `bar.high` / `bar.low` / `bar.close` directly
 * (mirrors Pine's `ta.dmi(length)` — no source param). Both series
 * ∈ [0, 100] when defined; NaN until `length` closed bars have
 * folded into the seed window. The first defined value lands at
 * bar index `length` (counted zero-based — matches the
 * full-recompute reference in `lib/wilderDirectional.ts`).
 *
 * @formula  TR[t]     = max(high − low, |high − prevClose|, |low − prevClose|) ;
 *           upMove    = high[t] − high[t−1] ; downMove = low[t−1] − low[t] ;
 *           +DM       = upMove   > downMove && upMove   > 0 ? upMove   : 0 ;
 *           −DM       = downMove > upMove   && downMove > 0 ? downMove : 0 ;
 *           seed at bar `length` = simple sum over the seed window ;
 *           smoothed via wilderStep(α = 1/length) thereafter ;
 *           +DI       = 100 · smoothed+DM / smoothedTR ;
 *           −DI       = 100 · smoothed−DM / smoothedTR ;
 *           DI falls back to 0 when smoothedTR is 0 (matches invinite).
 * @warmup   length
 * @since 0.2
 * @experimental
 *
 * `opts.offset` shifts both series in lockstep (PLAN.md §9.1) —
 * `series.current` on each output returns the value `offset` bars
 * ago.
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const d = ta.dmi("slot", 14);
 *     // plot(d.plusDi);
 *     // plot(d.minusDi);
 */
export function dmi(slotId: string, length: number, opts?: DmiOpts): DmiResult {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as DmiSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(length, ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const bar = ctx.stream.bar;
    if (ctx.isTick) {
        const { plusDi, minusDi } = tickDirectional(slot.dirState, bar.high, bar.low, bar.close);
        slot.plusDiBuffer.replaceHead(plusDi);
        slot.minusDiBuffer.replaceHead(minusDi);
    } else {
        const { plusDi, minusDi } = advanceDirectionalClose(
            slot.dirState,
            bar.high,
            bar.low,
            bar.close,
        );
        slot.plusDiBuffer.append(plusDi);
        slot.minusDiBuffer.append(minusDi);
    }
    return resultForOffset(slot, opts?.offset ?? 0);
}
