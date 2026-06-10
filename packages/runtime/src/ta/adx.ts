// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/adx.ts
//   plus lib/wilder-directional.ts + lib/adx-from-di.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. ADX reads `bar.high` / `bar.low` /
// `bar.close` directly (mirrors Pine's `ta.adx(length)` — no source
// param) and runs the Wilder DI smoothing AND the DX → Wilder-
// smoothed ADX recurrence incrementally via `wilderStep` (the same
// per-step recurrence the reference helpers
// `lib/wilderDirectional.ts` + `lib/adxFromDi.ts` use internally).

import type { AdxOpts, Series } from "@invinite-org/chartlang-core";

import {
    advanceDirectionalClose,
    initDirectionalState,
    tickDirectional,
} from "./lib/directionalState.js";
import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView, makeShiftedSeriesView } from "../seriesView.js";
import { wilderStep } from "./lib/wilderSmoothing.js";

const DEFAULT_SMOOTHING = 14;

type AdxSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly smoothingLength: number;
    readonly dirState: ReturnType<typeof initDirectionalState>;
    /** Running sum of DX samples while the ADX seed window fills. */
    dxSeed: number;
    /** Number of DX samples folded into the seed (0..smoothingLength). */
    dxSeedCount: number;
    /** Wilder-smoothed ADX. NaN until the DX seed completes. */
    adx: number;
    /** ADX as of the prior closed bar — used by tick-mode replay. */
    prevClosedAdx: number;
    /** DX seed accumulator + count as of the prior closed bar — used by
     * tick replay when the seed window is still filling. */
    prevClosedDxSeed: number;
    prevClosedDxSeedCount: number;
    /** Per-offset Series-view cache; see `sma.ts` for the convention. */
    readonly shiftedViews: Map<number, Series<number>>;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.adx called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, smoothingLength: number, capacity: number): AdxSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        smoothingLength,
        dirState: initDirectionalState(length),
        dxSeed: 0,
        dxSeedCount: 0,
        adx: Number.NaN,
        prevClosedAdx: Number.NaN,
        prevClosedDxSeed: 0,
        prevClosedDxSeedCount: 0,
        shiftedViews: new Map(),
    };
}

function viewForOffset(slot: AdxSlot, offset: number): Series<number> {
    if (offset === 0) return slot.series;
    let view = slot.shiftedViews.get(offset);
    if (view === undefined) {
        view = makeShiftedSeriesView<number>(slot.outBuffer, offset);
        slot.shiftedViews.set(offset, view);
    }
    return view;
}

function dxFromDi(plusDi: number, minusDi: number): number {
    const sum = plusDi + minusDi;
    if (sum === 0) return 0;
    return (100 * Math.abs(plusDi - minusDi)) / sum;
}

function closeValue(slot: AdxSlot, high: number, low: number, close: number): number {
    if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
        // NaN inputs: do not advance the DI / DX recurrence. Hold the
        // prior ADX forward (matches `atr.ts` / `rsi.ts` NaN-input
        // semantics). The DI helper's own NaN handling already returns
        // the held-forward DI, but folding the held-DI into a fresh DX
        // would falsely advance the ADX recurrence.
        return Number.isFinite(slot.adx) ? slot.adx : Number.NaN;
    }
    const { plusDi, minusDi } = advanceDirectionalClose(slot.dirState, high, low, close);
    if (!Number.isFinite(plusDi) || !Number.isFinite(minusDi)) {
        // DI still in warmup — capture prior state for tick replay.
        slot.prevClosedAdx = slot.adx;
        slot.prevClosedDxSeed = slot.dxSeed;
        slot.prevClosedDxSeedCount = slot.dxSeedCount;
        return Number.NaN;
    }
    const dx = dxFromDi(plusDi, minusDi);
    // Capture prior state BEFORE folding this close into the DX seed.
    slot.prevClosedAdx = slot.adx;
    slot.prevClosedDxSeed = slot.dxSeed;
    slot.prevClosedDxSeedCount = slot.dxSeedCount;

    if (slot.dxSeedCount < slot.smoothingLength) {
        slot.dxSeed += dx;
        slot.dxSeedCount += 1;
        if (slot.dxSeedCount === slot.smoothingLength) {
            slot.adx = slot.dxSeed / slot.smoothingLength;
            return slot.adx;
        }
        return Number.NaN;
    }
    slot.adx = wilderStep(slot.adx, dx, slot.smoothingLength);
    return slot.adx;
}

function tickValue(slot: AdxSlot, high: number, low: number, close: number): number {
    const { plusDi, minusDi } = tickDirectional(slot.dirState, high, low, close);
    if (!Number.isFinite(plusDi) || !Number.isFinite(minusDi)) {
        // Defensive: `tickDirectional` returns NaN only when the
        // directional-state warmup has not completed (barCount <
        // length + 1) — and at that point `slot.adx` is still NaN
        // (adx warms strictly later than DI). So `Number.isFinite(slot.adx)`
        // is always false on this branch; kept for safety.
        return /* c8 ignore next */ Number.isFinite(slot.adx) ? slot.adx : Number.NaN;
    }
    const dx = dxFromDi(plusDi, minusDi);
    // Defensive: the close-side advance runs first on every bar and
    // raises `prevClosedDxSeedCount` to `smoothingLength` once the
    // seed window completes. The tick-side never observes a partial
    // DX-seed window because the bar that completes it has already
    // committed its close-side increment by the time `tickValue` runs.
    /* c8 ignore start */
    if (slot.prevClosedDxSeedCount < slot.smoothingLength) {
        const provisionalCount = slot.prevClosedDxSeedCount + 1;
        if (provisionalCount < slot.smoothingLength) return Number.NaN;
        return (slot.prevClosedDxSeed + dx) / slot.smoothingLength;
    }
    /* c8 ignore stop */
    return wilderStep(slot.prevClosedAdx, dx, slot.smoothingLength);
}

/**
 * Wilder's Average Directional Index — single-line trend-strength
 * oscillator bounded in `[0, 100]`. Reads `bar.high` / `bar.low` /
 * `bar.close` directly (mirrors Pine's `ta.adx(length)` — no source
 * param). Composes onto the same Wilder directional-movement
 * recurrence `ta.dmi` runs (`+DI` / `−DI` from Wilder-smoothed `+DM`
 * / `−DM` / TR), then folds DX = `100 · |+DI − −DI| / (+DI + −DI)`
 * into a second Wilder-smoothing window of length
 * `opts.smoothing` (default `14`).
 *
 * @formula  +DI, −DI per `ta.dmi(length)` ;
 *           DX[t]  = (+DI + −DI) === 0 ? 0 : 100 · |+DI − −DI| / (+DI + −DI) ;
 *           seed at first defined ADX bar = mean(DX over `smoothing` samples) ;
 *           ADX[t] = wilderStep(ADX[t−1], DX[t], smoothing)
 * @warmup   length + smoothing − 1
 * @anchors  length, smoothing
 * @since 0.2
 * @stable
 *
 * `opts.offset` shifts the returned series (PLAN.md §9.1) —
 * `series.current` returns the value `offset` bars ago.
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const a = ta.adx("slot", 14);
 *     // plot(a);
 *     // const lagged = ta.adx("slot2", 14, { offset: 5 });
 */
export function adx(slotId: string, length: number, opts?: AdxOpts): Series<number> {
    const ctx = getCtx();
    const smoothingLength = opts?.smoothing ?? DEFAULT_SMOOTHING;
    let slot = ctx.stream.taSlots.get(slotId) as AdxSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(length, smoothingLength, ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const bar = ctx.stream.bar;
    if (ctx.isTick) {
        slot.outBuffer.replaceHead(tickValue(slot, bar.high, bar.low, bar.close));
    } else {
        slot.outBuffer.append(closeValue(slot, bar.high, bar.low, bar.close));
    }
    return viewForOffset(slot, opts?.offset ?? 0);
}
