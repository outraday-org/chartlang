// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/volatility-stop.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. Volatility Stop composes Phase-1 `ta.atr` at
// sub-slot `${slotId}/atr` (mirrors Supertrend); the source is
// hard-coded to `bar.close` (Pine `ta.vstop` convention; invinite's
// `source` field is deliberately dropped). The recurrence runs
// incrementally one bar at a time; tick-mode replays the recurrence
// from a per-bar snapshot of the state at the start of the current
// bar so a partial-bar tick doesn't pollute the next close's flip
// detection.

import type { VolatilityStopOpts, VolatilityStopResult } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView } from "../seriesView.js";
import { atr } from "./atr.js";

const DEFAULT_LENGTH = 20;
const DEFAULT_MULTIPLIER = 2;

const TREND_UP = 1;
const TREND_DOWN = -1;
const TREND_UNKNOWN = 0;

type Trend = 1 | -1 | 0;

type VolatilityStopSlot = {
    readonly outputs: VolatilityStopResult;
    readonly valueBuffer: Float64RingBuffer;
    readonly directionBuffer: Float64RingBuffer;
    readonly length: number;
    readonly multiplier: number;
    /** Number of CLOSED bars folded into the slot WITH FINITE ATR. */
    warmBarCount: number;
    direction: Trend;
    prevStop: number;
    prevSrc: number;
    // Snapshot (start-of-current-bar).
    prevClosedWarmBarCount: number;
    prevClosedDirection: Trend;
    prevClosedPrevStop: number;
    prevClosedPrevSrc: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.volatilityStop called outside an active script step");
    }
    return ctx;
}

function initSlot(capacity: number, length: number, multiplier: number): VolatilityStopSlot {
    const valueBuffer = new Float64RingBuffer(capacity);
    const directionBuffer = new Float64RingBuffer(capacity);
    return {
        outputs: Object.freeze({
            value: makeSeriesView<number>(valueBuffer),
            direction: makeSeriesView<number>(directionBuffer),
        }),
        valueBuffer,
        directionBuffer,
        length,
        multiplier,
        warmBarCount: 0,
        direction: TREND_UNKNOWN,
        prevStop: Number.NaN,
        prevSrc: Number.NaN,
        prevClosedWarmBarCount: 0,
        prevClosedDirection: TREND_UNKNOWN,
        prevClosedPrevStop: Number.NaN,
        prevClosedPrevSrc: Number.NaN,
    };
}

function snapshot(slot: VolatilityStopSlot): void {
    slot.prevClosedWarmBarCount = slot.warmBarCount;
    slot.prevClosedDirection = slot.direction;
    slot.prevClosedPrevStop = slot.prevStop;
    slot.prevClosedPrevSrc = slot.prevSrc;
}

/**
 * One step of the Volatility Stop recurrence given the prior CLOSED-
 * bar snapshot. Returns the new `(value, direction)` for this bar.
 * Used by both close-side (which mutates the slot) and tick-side
 * (which reads the snapshot, does NOT mutate the slot).
 */
function recurrenceStep(
    src: number,
    atrValue: number,
    multiplier: number,
    prevDirection: Trend,
    prevStop: number,
    prevSrc: number,
): { value: number; direction: number; nextDirection: Trend; nextStop: number } {
    if (prevDirection === TREND_UNKNOWN) {
        // Second warm bar — decide initial direction from src[i] vs
        // src[i-1]. Initial stop seeds from the deviation band.
        const newDirection: Trend = src >= prevSrc ? TREND_UP : TREND_DOWN;
        const stop =
            newDirection === TREND_UP ? src - multiplier * atrValue : src + multiplier * atrValue;
        return {
            value: stop,
            direction: newDirection,
            nextDirection: newDirection,
            nextStop: stop,
        };
    }
    if (prevDirection === TREND_UP) {
        let next = src - multiplier * atrValue;
        if (next < prevStop) next = prevStop;
        if (src < next) {
            next = src + multiplier * atrValue;
            return {
                value: next,
                direction: TREND_DOWN,
                nextDirection: TREND_DOWN,
                nextStop: next,
            };
        }
        return { value: next, direction: TREND_UP, nextDirection: TREND_UP, nextStop: next };
    }
    // prevDirection === TREND_DOWN.
    let next = src + multiplier * atrValue;
    if (next > prevStop) next = prevStop;
    if (src > next) {
        next = src - multiplier * atrValue;
        return {
            value: next,
            direction: TREND_UP,
            nextDirection: TREND_UP,
            nextStop: next,
        };
    }
    return { value: next, direction: TREND_DOWN, nextDirection: TREND_DOWN, nextStop: next };
}

function closeStep(
    slot: VolatilityStopSlot,
    src: number,
    atrValue: number,
): { value: number; direction: number } {
    // NaN suspends state: don't advance live fields. Snapshot stays
    // pinned to the prior bar's state.
    if (!Number.isFinite(src) || !Number.isFinite(atrValue)) {
        return { value: Number.NaN, direction: Number.NaN };
    }
    snapshot(slot);
    if (slot.warmBarCount === 0) {
        // First warm bar — can't decide direction yet (need a prior
        // src to compare). Seed `prevSrc` and emit NaN.
        slot.warmBarCount = 1;
        slot.prevSrc = src;
        slot.direction = TREND_UNKNOWN;
        slot.prevStop = Number.NaN;
        return { value: Number.NaN, direction: Number.NaN };
    }
    const step = recurrenceStep(
        src,
        atrValue,
        slot.multiplier,
        slot.direction,
        slot.prevStop,
        slot.prevSrc,
    );
    slot.warmBarCount += 1;
    slot.direction = step.nextDirection;
    slot.prevStop = step.nextStop;
    slot.prevSrc = src;
    return { value: step.value, direction: step.direction };
}

function tickStep(
    slot: VolatilityStopSlot,
    src: number,
    atrValue: number,
): { value: number; direction: number } {
    if (!Number.isFinite(src) || !Number.isFinite(atrValue)) {
        return { value: Number.NaN, direction: Number.NaN };
    }
    if (slot.prevClosedWarmBarCount === 0) {
        // The current bar is the first warm bar — its tick replay is
        // the seed (NaN, NaN — direction undecided).
        return { value: Number.NaN, direction: Number.NaN };
    }
    const step = recurrenceStep(
        src,
        atrValue,
        slot.multiplier,
        slot.prevClosedDirection,
        slot.prevClosedPrevStop,
        slot.prevClosedPrevSrc,
    );
    return { value: step.value, direction: step.direction };
}

/**
 * Volatility Stop — PSAR-like trend-following stop driven by ATR
 * instead of acceleration factors. Trend up: `stop[i] = max(prevStop,
 * src − multiplier · atr)`; flip to down when `src < stop[i]`, reset
 * to `src + multiplier · atr`. Trend down symmetric. Reads
 * `bar.close` as source (Pine `ta.vstop` convention — invinite's
 * `source` opt is omitted; a `source` opt could land in a follow-up).
 * Composes `ta.atr` at sub-slot `${slotId}/atr`. Returns a
 * cached `{ value, direction }` record (same identity every bar).
 *
 * `direction` is `+1` (uptrend → stop is BELOW price), `-1`
 * (downtrend → stop is ABOVE price), NaN during warmup or NaN-
 * suspension. Warmup is `length` (ATR's warmup) — the FIRST warm bar
 * emits NaN (need a prior close to decide direction); the SECOND
 * warm bar seeds direction from `src[i] vs src[i-1]`.
 *
 * NaN ATR or NaN src → NaN outputs; local state freezes so the next
 * finite bar resumes from the prior closed state. Tick-mode replays
 * the recurrence from the snapshot captured at the start of the
 * current bar (mirrors PSAR / Supertrend).
 *
 * @formula  up   : value = max(prevStop, src − multiplier · atr) ; flip to down on src < value ;
 *           down : value = min(prevStop, src + multiplier · atr) ; flip to up   on src > value
 * @warmup   length
 * @anchors  length, multiplier
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const v = ta.volatilityStop({ length: 20, multiplier: 2 });
 *     // plot(v.value);
 */
export function volatilityStop(slotId: string, opts?: VolatilityStopOpts): VolatilityStopResult {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as VolatilityStopSlot | undefined;
    if (slot === undefined) {
        const length = opts?.length ?? DEFAULT_LENGTH;
        const multiplier = opts?.multiplier ?? DEFAULT_MULTIPLIER;
        slot = initSlot(ctx.stream.ohlcv.close.capacity, length, multiplier);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const atrSeries = atr(`${slotId}/atr`, slot.length);
    const src = ctx.stream.bar.close;
    const atrValue = atrSeries.current;
    if (ctx.isTick) {
        const { value, direction } = tickStep(slot, src, atrValue);
        slot.valueBuffer.replaceHead(value);
        slot.directionBuffer.replaceHead(direction);
    } else {
        const { value, direction } = closeStep(slot, src, atrValue);
        slot.valueBuffer.append(value);
        slot.directionBuffer.append(direction);
    }
    return slot.outputs;
}
