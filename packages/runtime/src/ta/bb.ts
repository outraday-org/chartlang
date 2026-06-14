// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/bb.ts
//   (commit d2d1043c1b039f66d2f3674526d303d31cf2f1e0, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. BB is composed from `sma` + `stdev` via
// sub-slot ids so a fix to either primitive flows in for free.

import type { BbOpts, BbResult, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView, makeShiftedSeriesView } from "../seriesView.js";
import { sma } from "./sma.js";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue.js";
import { stdev } from "./stdev.js";

const DEFAULT_MULTIPLIER = 2;

type BbSlot = {
    readonly result: BbResult;
    readonly upper: Float64RingBuffer;
    readonly middle: Series<number>;
    readonly lower: Float64RingBuffer;
    /**
     * Reference to the SMA sub-slot's output ring buffer. Captured at
     * first call so per-offset shifted middle views can be constructed
     * without re-entering `sma()` (which would double-advance the
     * sub-slot's compute on every bar).
     */
    readonly middleBuf: Float64RingBuffer;
    /**
     * Per-offset frozen `BbResult` cache. `offset === 0` returns
     * `result` directly (identity-preserving). Each cached result
     * proxies the same three underlying buffers via shifted views.
     */
    readonly shiftedResults: Map<number, BbResult>;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.bb called outside an active script step");
    }
    return ctx;
}

function initSlot(capacity: number, middle: Series<number>, middleBuf: Float64RingBuffer): BbSlot {
    const upper = new Float64RingBuffer(capacity);
    const lower = new Float64RingBuffer(capacity);
    const upperView = makeSeriesView<number>(upper);
    const lowerView = makeSeriesView<number>(lower);
    return {
        result: Object.freeze({ upper: upperView, middle, lower: lowerView }),
        upper,
        middle,
        lower,
        middleBuf,
        shiftedResults: new Map(),
    };
}

function resultForOffset(slot: BbSlot, offset: number): BbResult {
    if (offset === 0) return slot.result;
    let cached = slot.shiftedResults.get(offset);
    if (cached === undefined) {
        cached = Object.freeze({
            upper: makeShiftedSeriesView<number>(slot.upper, offset),
            middle: makeShiftedSeriesView<number>(slot.middleBuf, offset),
            lower: makeShiftedSeriesView<number>(slot.lower, offset),
        });
        slot.shiftedResults.set(offset, cached);
    }
    return cached;
}

/**
 * Bollinger Bands — `multiplier × σ` envelope around an SMA(length)
 * middle band. Default `multiplier = 2` per Pine. Returns a cached
 * `{ upper, middle, lower }` record (same identity every bar) backed
 * by three `Series<number>` Proxies. The middle band is the
 * underlying SMA primitive's output (identity-shared).
 *
 * @formula  middle = sma(source, length) ;
 *           σ      = stdev(source, length, { biased: true }) ;
 *           upper  = middle + multiplier · σ ;
 *           lower  = middle − multiplier · σ
 * @warmup   length − 1
 * @since 0.1
 * @stable
 *
 * `opts.offset` shifts all three bands in lockstep —
 * `series.current` on each band returns the value `offset` bars ago.
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const bands = ta.bb("slot", bar.close, 20, { multiplier: 2 });
 *     // const u = bands.upper.current;
 *     // const lagged = ta.bb("slot2", bar.close, 20, { offset: 5 });
 */
export function bb(
    slotId: string,
    source: ScalarOrSeries,
    length: number,
    opts?: BbOpts,
): BbResult {
    const ctx = getCtx();
    const multiplier = opts?.multiplier ?? DEFAULT_MULTIPLIER;
    const src = readSourceValue(source);
    const middleSlotId = `${slotId}/sma`;
    const stdevSlotId = `${slotId}/stdev`;
    // Compose: sma updates the middle band; stdev updates a separate
    // rolling-sigma series. Both primitives respect ctx.isTick. The
    // un-shifted middle (no offset) drives the per-bar math; the
    // shifted middle for non-zero offset is composed lazily in
    // `resultForOffset` to keep the close-path tight.
    const middleSeries = sma(middleSlotId, src, length);
    // BB's invinite math uses population sigma (denominator length); we
    // pass `biased: true` so the helper matches.
    const sigmaSeries = stdev(stdevSlotId, src, length, { biased: true });

    let slot = ctx.stream.taSlots.get(slotId) as BbSlot | undefined;
    if (slot === undefined) {
        // Capture the SMA sub-slot's output ring buffer so future
        // shifted-view lookups don't need to re-enter `sma()`.
        const smaSlot = ctx.stream.taSlots.get(middleSlotId) as { outBuffer: Float64RingBuffer };
        slot = initSlot(ctx.stream.ohlcv.close.capacity, middleSeries, smaSlot.outBuffer);
        ctx.stream.taSlots.set(slotId, slot);
    }

    const mid = middleSeries.current;
    const sigma = sigmaSeries.current;
    let upperValue: number;
    let lowerValue: number;
    if (Number.isFinite(mid) && Number.isFinite(sigma)) {
        upperValue = mid + multiplier * sigma;
        lowerValue = mid - multiplier * sigma;
    } else {
        upperValue = Number.NaN;
        lowerValue = Number.NaN;
    }
    if (ctx.isTick) {
        slot.upper.replaceHead(upperValue);
        slot.lower.replaceHead(lowerValue);
    } else {
        slot.upper.append(upperValue);
        slot.lower.append(lowerValue);
    }
    return resultForOffset(slot, opts?.offset ?? 0);
}
