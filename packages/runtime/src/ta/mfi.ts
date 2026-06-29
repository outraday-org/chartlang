// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/mfi.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. The rolling-window pos / neg money-flow sums
// follow the `cmf.ts` / `ulcerIndex.ts` "subtract head + add tick"
// tick-mode shape (no window mutation on tick).

import type { MfiOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView, makeShiftedSeriesView } from "../seriesView.js";

type MfiSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly shiftedViews: Map<number, Series<number>>;
    readonly length: number;
    /** Closed-bar positive money-flow contributions (capacity `length`). */
    readonly posMfWindow: Float64RingBuffer;
    /** Closed-bar negative money-flow contributions. */
    readonly negMfWindow: Float64RingBuffer;
    sumPosMf: number;
    sumNegMf: number;
    /** Most recent finite typical price (lookback target for the next bar). */
    prevTp: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.mfi called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, capacity: number): MfiSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        shiftedViews: new Map(),
        length,
        posMfWindow: new Float64RingBuffer(length),
        negMfWindow: new Float64RingBuffer(length),
        sumPosMf: 0,
        sumNegMf: 0,
        prevTp: Number.NaN,
    };
}

function viewForOffset(slot: MfiSlot, offset: number): Series<number> {
    if (offset === 0) return slot.series;
    let view = slot.shiftedViews.get(offset);
    if (view === undefined) {
        view = makeShiftedSeriesView<number>(slot.outBuffer, offset);
        slot.shiftedViews.set(offset, view);
    }
    return view;
}

/**
 * Per-bar typical-price contributions to the (posMF, negMF) split,
 * given the prior typical price. NaN OHLC / volume → (0, 0). Equal
 * `tp === prevTp` or first bar (`prevTp` NaN) → (0, 0) per Pine
 * convention.
 */
function bucketMf(tp: number, prevTp: number, volume: number): { posMf: number; negMf: number } {
    if (!Number.isFinite(tp) || !Number.isFinite(volume)) {
        return { posMf: 0, negMf: 0 };
    }
    if (!Number.isFinite(prevTp) || tp === prevTp) {
        return { posMf: 0, negMf: 0 };
    }
    const mf = tp * volume;
    if (tp > prevTp) return { posMf: mf, negMf: 0 };
    return { posMf: 0, negMf: mf };
}

function emitMfi(sumPos: number, sumNeg: number, ready: boolean): number {
    if (!ready) return Number.NaN;
    const total = sumPos + sumNeg;
    if (total === 0) return Number.NaN;
    return (100 * sumPos) / total;
}

/**
 * Money Flow Index — volume-weighted RSI over a trailing window of
 * `length` typical-price comparisons. Per-bar typical price `tp = (H +
 * L + C) / 3`; per-bar money flow `mf = tp · volume` lands in the
 * positive bucket when `tp > prevTp`, in the negative bucket when
 * `tp < prevTp`, and is dropped on equality / first bar. The emit is
 * `100 · sumPos / (sumPos + sumNeg)` once `length` such comparisons
 * have accumulated; NaN before warmup and when `sumPos + sumNeg ===
 * 0` (no flow either way — invinite's zero-denominator guard).
 *
 * Range `[0, 100]` when defined: `sumPos === 0` → 0 (perfect
 * downflow); `sumNeg === 0` with `sumPos > 0` → 100 (perfect
 * upflow). NaN OHLC / volume contributes 0 to both buckets (matches
 * `cmf.ts:62-75`'s defensive shape).
 *
 * **Tick mode.** Substitutes the tick's (posMf, negMf) contribution
 * for the head slot's stored values without mutating the trailing-
 * window rings or advancing `prevTp` — mirrors `cmf.ts:125-138`.
 *
 * @formula  tp  = (high + low + close) / 3 ;
 *           mf  = tp · volume ;
 *           pos = mf when tp > prevTp else 0 ;
 *           neg = mf when tp < prevTp else 0 ;
 *           mfi = 100 · Σ pos / (Σ pos + Σ neg) over the trailing `length` window
 * @warmup   length + 1   (one bar to seed prevTp + `length` comparisons)
 * @since 0.2
 * @stable
 *
 * `opts.offset` is a presentation display shift carried to the plot
 * emission as `xShift` (`+n` right / future, `−n` left / past); the
 * series value is unshifted.
 *
 * @example
 *     // import { ta, plot } from "@invinite-org/chartlang-core";
 *     // const m = ta.mfi(14);
 *     // plot(m);
 */
export function mfi(slotId: string, length: number, opts?: MfiOpts): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as MfiSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(length, ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const offset = opts?.offset ?? 0;
    // `bar.{high,low,close,volume}` are number-coercible series-view proxies —
    // coerce at the read so `bucketMf`'s `Number.isFinite` guards see real
    // numbers.
    const bar = ctx.stream.bar;
    const high = +bar.high;
    const low = +bar.low;
    const close = +bar.close;
    const volume = +bar.volume;
    const tp = (high + low + close) / 3;
    const { posMf, negMf } = bucketMf(tp, slot.prevTp, volume);

    // The seed bar (prevTp NaN) contributes no real comparison — we
    // skip the window append so the trailing window only ever holds
    // `length` REAL (prevTp-defined) comparisons. First finite emit
    // lands at bar `length` (warmup `length + 1` per the JSDoc).
    const hasComparison = Number.isFinite(slot.prevTp);

    if (ctx.isTick) {
        const ready = slot.posMfWindow.length === slot.length;
        if (!ready || !hasComparison) {
            slot.outBuffer.replaceHead(Number.NaN);
            return viewForOffset(slot, offset);
        }
        const headPos = slot.posMfWindow.at(0);
        const headNeg = slot.negMfWindow.at(0);
        const hypPos = slot.sumPosMf - headPos + posMf;
        const hypNeg = slot.sumNegMf - headNeg + negMf;
        slot.outBuffer.replaceHead(emitMfi(hypPos, hypNeg, true));
        return viewForOffset(slot, offset);
    }

    if (hasComparison) {
        if (slot.posMfWindow.length === slot.length) {
            slot.sumPosMf -= slot.posMfWindow.at(slot.length - 1);
            slot.sumNegMf -= slot.negMfWindow.at(slot.length - 1);
        }
        slot.posMfWindow.append(posMf);
        slot.negMfWindow.append(negMf);
        slot.sumPosMf += posMf;
        slot.sumNegMf += negMf;
    }
    if (Number.isFinite(tp)) slot.prevTp = tp;
    slot.outBuffer.append(
        emitMfi(slot.sumPosMf, slot.sumNegMf, slot.posMfWindow.length === slot.length),
    );
    return viewForOffset(slot, offset);
}
