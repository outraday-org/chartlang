// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/alma.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. The ALMA `offset` opt is the Gaussian centre
// in `[0, 1]` (default 0.85), distinct from the universal bar-shift
// which lives on `opts.barShift`.

import type { AlmaOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView } from "../seriesView.js";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue.js";

const DEFAULT_OFFSET = 0.85;
const DEFAULT_SIGMA = 6;

type AlmaSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly length: number;
    /**
     * Trailing `length` source values; `at(0)` is the head (most
     * recent), `at(length - 1)` is the oldest still in the window.
     */
    readonly sourceWindow: Float64RingBuffer;
    /**
     * Pre-computed Gaussian weights. `weights[j]` aligns with the
     * j-th OLDEST window entry (i.e. `window.at(length - 1 - j)`) so
     * `j = length - 1` weights the head and `j = 0` weights the
     * oldest — matches the invinite reference's `computeAlma` loop.
     */
    readonly weights: Float64Array;
    readonly normaliser: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.alma called outside an active script step");
    }
    return ctx;
}

function initSlot(length: number, offsetCentre: number, sigma: number, capacity: number): AlmaSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    const m = offsetCentre * (length - 1);
    const s = length / sigma;
    const weights = new Float64Array(length);
    let normaliser = 0;
    for (let j = 0; j < length; j += 1) {
        const d = j - m;
        const w = Math.exp(-(d * d) / (2 * s * s));
        weights[j] = w;
        normaliser += w;
    }
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        length,
        sourceWindow: new Float64RingBuffer(length),
        weights,
        normaliser,
    };
}

function weightedFromWindow(slot: AlmaSlot, headOverride?: number): number {
    let sum = 0;
    for (let j = 0; j < slot.length; j += 1) {
        // j = 0 → oldest (window.at(length - 1)); j = length - 1 → head.
        const ageFromHead = slot.length - 1 - j;
        const v =
            ageFromHead === 0 && headOverride !== undefined
                ? headOverride
                : slot.sourceWindow.at(ageFromHead);
        if (!Number.isFinite(v)) return Number.NaN;
        sum += v * slot.weights[j];
    }
    return sum / slot.normaliser;
}

function closeValue(slot: AlmaSlot, src: number): number {
    slot.sourceWindow.append(src);
    if (slot.sourceWindow.length < slot.length) return Number.NaN;
    return weightedFromWindow(slot);
}

function tickValue(slot: AlmaSlot, src: number): number {
    if (slot.sourceWindow.length < slot.length) return Number.NaN;
    if (!Number.isFinite(src)) return Number.NaN;
    return weightedFromWindow(slot, src);
}

/**
 * Arnaud Legoux Moving Average — a Gaussian-weighted MA. Weights peak
 * at `offset · (length − 1)` (default `0.85 · (length − 1)`, near the
 * recent end of the window) and decay with standard deviation
 * `length / sigma` (default `length / 6`). Weights are pre-computed
 * once at slot init from `opts.offset` + `opts.sigma`; per-bar cost is
 * an O(length) window walk. A NaN anywhere in the window
 * short-circuits the output to NaN (matches the WMA full-recompute
 * weighted-window convention).
 *
 * **`opts.offset` is the Gaussian-centre position in `[0, 1]`**, NOT
 * the universal bar-shift. The universal shift on ALMA uses the
 * distinct `opts.barShift` field — accepted on the surface (its
 * runtime side is wired alongside the universal `offset` support on
 * every primitive).
 *
 * @formula  m = offset · (length − 1) ;
 *           s = length / sigma ;
 *           w[j] = exp(−((j − m)² / (2 · s²)))  for j = 0..length − 1 ;
 *           norm = Σ w[j] ;
 *           out[t] = (Σ_{j=0..length-1} w[j] · src[t − length + 1 + j]) / norm
 * @warmup   length − 1
 * @anchors  offset, sigma
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const a = ta.alma(bar.close, 9, { offset: 0.85, sigma: 6 });
 *     // plot(a);
 */
export function alma(
    slotId: string,
    source: ScalarOrSeries,
    length: number,
    opts?: AlmaOpts,
): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as AlmaSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(
            length,
            opts?.offset ?? DEFAULT_OFFSET,
            opts?.sigma ?? DEFAULT_SIGMA,
            ctx.stream.ohlcv.close.capacity,
        );
        ctx.stream.taSlots.set(slotId, slot);
    }
    const src = readSourceValue(source);
    if (ctx.isTick) {
        slot.outBuffer.replaceHead(tickValue(slot, src));
    } else {
        slot.outBuffer.append(closeValue(slot, src));
    }
    return slot.series;
}
