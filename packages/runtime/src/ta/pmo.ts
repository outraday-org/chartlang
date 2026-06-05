// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/pmo.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.

import type { PmoOpts, PmoResult } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView, makeShiftedSeriesView } from "../seriesView";
import { ema } from "./ema";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue";

const DEFAULT_FIRST = 35;
const DEFAULT_SECOND = 20;
const DEFAULT_SIGNAL = 10;

/**
 * Carl Swenlin's PMO uses a non-canonical EMA factor for the two
 * inner stages: `α = 2 / length` (NOT the standard `α = 2 / (length + 1)`).
 * The signal-line EMA (stage 5) uses the standard `ta.ema`. Per the
 * published TradingView formula:
 * https://www.tradingview.com/support/solutions/43000773010
 */
type SwenlinEmaState = {
    readonly alpha: number;
    readonly length: number;
    seedSum: number;
    seedCount: number;
    prevClosedEma: number;
};

function makeSwenlinState(length: number): SwenlinEmaState {
    return {
        alpha: 2 / length,
        length,
        seedSum: 0,
        seedCount: 0,
        prevClosedEma: Number.NaN,
    };
}

function swenlinClose(state: SwenlinEmaState, src: number): number {
    if (!Number.isFinite(src)) {
        // Forward-hold prior closed EMA — mirrors invinite's
        // pmo.ts:130 "out[i] = out[i - 1]" branch.
        return state.prevClosedEma;
    }
    if (state.seedCount < state.length) {
        state.seedSum += src;
        state.seedCount += 1;
        if (state.seedCount < state.length) {
            state.prevClosedEma = Number.NaN;
            return Number.NaN;
        }
        const seedValue = state.seedSum / state.length;
        state.prevClosedEma = seedValue;
        return seedValue;
    }
    const prev = state.prevClosedEma;
    const next = src * state.alpha + prev * (1 - state.alpha);
    state.prevClosedEma = next;
    return next;
}

function swenlinTick(state: SwenlinEmaState, src: number): number {
    if (!Number.isFinite(src)) return state.prevClosedEma;
    if (state.seedCount < state.length) {
        const nextSum = state.seedSum + src;
        const nextCount = state.seedCount + 1;
        // Defensive: the seed-completion branch (`nextCount === length`)
        // is unreachable in normal flow because `swenlinClose` runs
        // first on every bar and would have raised `seedCount` to
        // `length` if this bar completes the seed window — making the
        // outer `seedCount < length` guard false on the tick path.
        /* c8 ignore next 3 */
        if (nextCount < state.length) return Number.NaN;
        return nextSum / state.length;
    }
    return src * state.alpha + state.prevClosedEma * (1 - state.alpha);
}

type PmoSlot = {
    readonly result: PmoResult;
    readonly pmoBuf: Float64RingBuffer;
    readonly signalBuf: Float64RingBuffer;
    readonly shiftedResults: Map<number, PmoResult>;
    readonly stage1: SwenlinEmaState;
    readonly stage2: SwenlinEmaState;
    prevSrc: number;
    prevClosedSrc: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.pmo called outside an active script step");
    }
    return ctx;
}

function resultForOffset(slot: PmoSlot, offset: number): PmoResult {
    if (offset === 0) return slot.result;
    let cached = slot.shiftedResults.get(offset);
    if (cached === undefined) {
        cached = Object.freeze({
            pmo: makeShiftedSeriesView<number>(slot.pmoBuf, offset),
            signal: makeShiftedSeriesView<number>(slot.signalBuf, offset),
        });
        slot.shiftedResults.set(offset, cached);
    }
    return cached;
}

function computeRoc1(src: number, prevSrc: number): number {
    if (!Number.isFinite(src) || !Number.isFinite(prevSrc) || prevSrc === 0) {
        return Number.NaN;
    }
    return (src / prevSrc - 1) * 1000;
}

/**
 * Carl Swenlin's Price Momentum Oscillator (PMO). Three-pass smoothing
 * of the 1-bar ROC, scaled to PMO's characteristic ±10 swing range:
 *
 *   1. `roc1[t] = ((src[t] / src[t-1]) - 1) × 1000`.
 *   2. `ema1 = SwenlinEMA(firstSmoothing)(roc1)` — `α = 2 / firstSmoothing`.
 *   3. `scaled = ema1 × 10`.
 *   4. `pmo  = SwenlinEMA(secondSmoothing)(scaled)` — `α = 2 / secondSmoothing`.
 *   5. `signal = EMA(signalLength)(pmo)` — standard `α = 2 / (signalLength + 1)`.
 *
 * The Swenlin EMA factor diverges from canonical `ta.ema`'s `α = 2 /
 * (length + 1)`; without it the PMO output is off by a multiplicative
 * constant. Matches TradingView's published PMO output verbatim.
 *
 * @formula  roc1[t]   = ((src[t]/src[t-1]) - 1) × 1000 ;
 *           ema1[t]   = SwenlinEMA(firstSmoothing)(roc1) ;
 *           pmo[t]    = SwenlinEMA(secondSmoothing)(ema1 × 10) ;
 *           signal[t] = EMA(signalLength)(pmo)
 * @warmup   firstSmoothing + secondSmoothing − 1 (pmo line); firstSmoothing + secondSmoothing + signalLength − 3 (signal line)
 * @since 0.2
 * @experimental
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const p = ta.pmo("slot", bar.close);
 *     // plot(p.pmo); plot(p.signal);
 */
export function pmo(slotId: string, source: ScalarOrSeries, opts?: PmoOpts): PmoResult {
    const ctx = getCtx();
    const firstSmoothing = opts?.firstSmoothing ?? DEFAULT_FIRST;
    const secondSmoothing = opts?.secondSmoothing ?? DEFAULT_SECOND;
    const signalLength = opts?.signalLength ?? DEFAULT_SIGNAL;
    const offset = opts?.offset ?? 0;
    const signalSlotId = `${slotId}/signal`;
    const isTick = ctx.isTick;
    const src = readSourceValue(source);

    let slot = ctx.stream.taSlots.get(slotId) as PmoSlot | undefined;

    // Stage 1: compute roc1 against the appropriate prev source.
    // The `?? Number.NaN` fallbacks below are defensive: in normal flow
    // the runner does a close-side advance before any tick, so by the
    // time `isTick` is true `slot` exists. On the close path, the
    // first-bar slot is still undefined and we want NaN ROC1.
    const prevForRoc = isTick
        ? /* c8 ignore next */ (slot?.prevClosedSrc ?? Number.NaN)
        : (slot?.prevSrc ?? Number.NaN);
    const roc1 = computeRoc1(src, prevForRoc);

    // Stages 2 + 4: Swenlin EMA chain. The stages live on the slot; if
    // slot is undefined this is the first bar and we materialise it.
    if (slot === undefined) {
        const pmoBuf = new Float64RingBuffer(ctx.stream.ohlcv.close.capacity);
        const stage1 = makeSwenlinState(firstSmoothing);
        const stage2 = makeSwenlinState(secondSmoothing);
        const stage1Value = swenlinClose(stage1, roc1);
        // Defensive: stage1Value is always NaN on bar 0 (Swenlin returns
        // NaN inside the seed window) so the `* 10` branch never fires
        // on the first-slot path.
        /* c8 ignore next */
        const scaled = Number.isFinite(stage1Value) ? stage1Value * 10 : Number.NaN;
        const stage2Value = swenlinClose(stage2, scaled);
        pmoBuf.append(stage2Value);
        const signalSeries = ema(signalSlotId, stage2Value, signalLength);
        const emaSlot = ctx.stream.taSlots.get(signalSlotId) as {
            outBuffer: Float64RingBuffer;
        };
        slot = {
            result: Object.freeze({
                pmo: makeSeriesView<number>(pmoBuf),
                signal: signalSeries,
            }),
            pmoBuf,
            signalBuf: emaSlot.outBuffer,
            shiftedResults: new Map(),
            stage1,
            stage2,
            prevSrc: src,
            prevClosedSrc: Number.NaN,
        };
        ctx.stream.taSlots.set(slotId, slot);
        return resultForOffset(slot, offset);
    }

    // Slot exists — advance / tick the chain.
    const stage1Value = isTick ? swenlinTick(slot.stage1, roc1) : swenlinClose(slot.stage1, roc1);
    const scaled = Number.isFinite(stage1Value) ? stage1Value * 10 : Number.NaN;
    const pmoValue = isTick ? swenlinTick(slot.stage2, scaled) : swenlinClose(slot.stage2, scaled);

    // Feed pmoValue into the signal EMA each bar (handles its own tick branch).
    void ema(signalSlotId, pmoValue, signalLength);

    if (isTick) {
        slot.pmoBuf.replaceHead(pmoValue);
    } else {
        slot.pmoBuf.append(pmoValue);
        slot.prevClosedSrc = slot.prevSrc;
        slot.prevSrc = src;
    }

    return resultForOffset(slot, offset);
}
