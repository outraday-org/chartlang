// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/kst.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. Composition: four `ta.sma` sub-slots (one per
// smoothed ROC) + one `ta.sma` sub-slot for the signal line. The four
// percentage ROCs are computed inline against the parent's source
// ring (same convention as `coppock.ts` — `ta.change` emits absolute
// deltas, while KST needs percentage rate-of-change).

import type { KstOpts, KstResult, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView } from "../seriesView.js";
import { sma } from "./sma.js";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue.js";

const DEFAULT_ROC1_LENGTH = 10;
const DEFAULT_ROC2_LENGTH = 15;
const DEFAULT_ROC3_LENGTH = 20;
const DEFAULT_ROC4_LENGTH = 30;
const DEFAULT_ROC1_SMOOTH = 10;
const DEFAULT_ROC2_SMOOTH = 10;
const DEFAULT_ROC3_SMOOTH = 10;
const DEFAULT_ROC4_SMOOTH = 15;
const DEFAULT_SIGNAL_LENGTH = 9;

type KstSlot = {
    result: KstResult | null;
    readonly kstBuf: Float64RingBuffer;
    readonly kstSeries: Series<number>;
    readonly roc1Length: number;
    readonly roc2Length: number;
    readonly roc3Length: number;
    readonly roc4Length: number;
    /**
     * Last `max(rocN) + 1` closed source values; `at(0)` is the head.
     * Shared by all four percentage-ROC computations.
     */
    readonly sourceWindow: Float64RingBuffer;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.kst called outside an active script step");
    }
    return ctx;
}

function pctRoc(current: number, lookback: number): number {
    if (!Number.isFinite(lookback) || lookback === 0 || !Number.isFinite(current)) {
        return Number.NaN;
    }
    return (100 * (current - lookback)) / lookback;
}

function rocFromWindow(window: Float64RingBuffer, src: number, length: number): number {
    if (window.length <= length) return Number.NaN;
    return pctRoc(src, window.at(length));
}

/**
 * Know Sure Thing (Martin Pring, 1992). Weighted sum of four SMA-
 * smoothed percentage rate-of-change series plus an SMA signal line.
 * Defaults `(10, 15, 20, 30, 10, 10, 10, 15, 9)` match Pring's
 * canonical settings. Composes 4 `ta.sma` sub-slots
 * (`${slotId}/r1Sma` .. `${slotId}/r4Sma`) for the smoothing layer
 * plus one `ta.sma` sub-slot (`${slotId}/signalSma`) for the signal
 * line. The percentage-ROC math is inline (mirrors `ta.coppock` —
 * `ta.change` emits absolute deltas, not percentages).
 *
 * The user-facing `signal` Series IS the signalSma sub-slot's own
 * Series view (no extra output buffer on the parent slot). The
 * `kst` Series wraps the parent's own `kstBuf` ring. Result identity
 * is captured on the first call and returned by reference thereafter.
 *
 * @formula  rN[t] = sma(pctRoc(source[t], source[t − rocNLength]), rocNSmooth) for N in 1..4 ;
 *           kst[t] = r1 + 2·r2 + 3·r3 + 4·r4 ; NaN if any rN NaN ;
 *           signal = sma(kst, signalLength)
 * @warmup   max_N(rocNLength + rocNSmooth) + signalLength − 2
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const k = ta.kst("slot", bar.close);
 *     // plot(k.kst); plot(k.signal);
 */
export function kst(slotId: string, source: ScalarOrSeries, opts?: KstOpts): KstResult {
    const ctx = getCtx();
    const roc1Length = opts?.roc1Length ?? DEFAULT_ROC1_LENGTH;
    const roc2Length = opts?.roc2Length ?? DEFAULT_ROC2_LENGTH;
    const roc3Length = opts?.roc3Length ?? DEFAULT_ROC3_LENGTH;
    const roc4Length = opts?.roc4Length ?? DEFAULT_ROC4_LENGTH;
    const roc1Smooth = opts?.roc1Smooth ?? DEFAULT_ROC1_SMOOTH;
    const roc2Smooth = opts?.roc2Smooth ?? DEFAULT_ROC2_SMOOTH;
    const roc3Smooth = opts?.roc3Smooth ?? DEFAULT_ROC3_SMOOTH;
    const roc4Smooth = opts?.roc4Smooth ?? DEFAULT_ROC4_SMOOTH;
    const signalLength = opts?.signalLength ?? DEFAULT_SIGNAL_LENGTH;

    const src = readSourceValue(source);

    let slot = ctx.stream.taSlots.get(slotId) as KstSlot | undefined;
    if (slot === undefined) {
        const capacity = ctx.stream.ohlcv.close.capacity;
        const kstBuf = new Float64RingBuffer(capacity);
        const lookbackCap = Math.max(roc1Length, roc2Length, roc3Length, roc4Length) + 1;
        slot = {
            result: null,
            kstBuf,
            kstSeries: makeSeriesView<number>(kstBuf),
            roc1Length,
            roc2Length,
            roc3Length,
            roc4Length,
            sourceWindow: new Float64RingBuffer(lookbackCap),
        };
        ctx.stream.taSlots.set(slotId, slot);
    }

    if (ctx.isTick) {
        slot.sourceWindow.replaceHead(src);
    } else {
        slot.sourceWindow.append(src);
    }

    const roc1 = rocFromWindow(slot.sourceWindow, src, slot.roc1Length);
    const roc2 = rocFromWindow(slot.sourceWindow, src, slot.roc2Length);
    const roc3 = rocFromWindow(slot.sourceWindow, src, slot.roc3Length);
    const roc4 = rocFromWindow(slot.sourceWindow, src, slot.roc4Length);

    const r1Series = sma(`${slotId}/r1Sma`, roc1, roc1Smooth);
    const r2Series = sma(`${slotId}/r2Sma`, roc2, roc2Smooth);
    const r3Series = sma(`${slotId}/r3Sma`, roc3, roc3Smooth);
    const r4Series = sma(`${slotId}/r4Sma`, roc4, roc4Smooth);

    const r1 = r1Series.current;
    const r2 = r2Series.current;
    const r3 = r3Series.current;
    const r4 = r4Series.current;

    const kstValue =
        Number.isFinite(r1) && Number.isFinite(r2) && Number.isFinite(r3) && Number.isFinite(r4)
            ? r1 + 2 * r2 + 3 * r3 + 4 * r4
            : Number.NaN;

    if (ctx.isTick) {
        slot.kstBuf.replaceHead(kstValue);
    } else {
        slot.kstBuf.append(kstValue);
    }

    const signalSeries = sma(`${slotId}/signalSma`, kstValue, signalLength);

    if (slot.result === null) {
        slot.result = Object.freeze({
            kst: slot.kstSeries,
            signal: signalSeries,
        });
    }
    return slot.result;
}
