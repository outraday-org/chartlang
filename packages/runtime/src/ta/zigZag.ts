// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/zig-zag.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. The chartlang port is **streaming**: the
// output `value` Series carries the most-recently-confirmed pivot
// price (held constant between confirmations), whereas invinite's
// batch `compute` linearly interpolates pivot→pivot and supports
// `extendToLastBar` retro-painting. The append-only Series model
// cannot rewrite older slots, so the streaming output is the closest
// representable surface — useful as a "trailing reference level".

import type { ZigZagOpts, ZigZagResult } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView } from "../seriesView";

const DEFAULT_DEVIATION = 5;
const DEFAULT_DEPTH = 10;

const TREND_UP = 1;
const TREND_DOWN = -1;
const TREND_UNKNOWN = 0;

type Trend = 1 | -1 | 0;

type ZigZagSlot = {
    readonly outputs: ZigZagResult;
    readonly valueBuffer: Float64RingBuffer;
    readonly directionBuffer: Float64RingBuffer;
    readonly deviation: number;
    readonly depth: number;
    // Live state.
    barCount: number;
    direction: Trend;
    lastPivotPrice: number;
    lastPivotIndex: number;
    peakSinceLastPivot: number;
    peakIndex: number;
    // Snapshot (start-of-current-bar) — captured each close BEFORE
    // the recurrence advances so a final tick replays from the seed.
    prevClosedBarCount: number;
    prevClosedDirection: Trend;
    prevClosedLastPivotPrice: number;
    prevClosedLastPivotIndex: number;
    prevClosedPeakSinceLastPivot: number;
    prevClosedPeakIndex: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.zigZag called outside an active script step");
    }
    return ctx;
}

function initSlot(capacity: number, deviation: number, depth: number): ZigZagSlot {
    const valueBuffer = new Float64RingBuffer(capacity);
    const directionBuffer = new Float64RingBuffer(capacity);
    return {
        outputs: Object.freeze({
            value: makeSeriesView<number>(valueBuffer),
            direction: makeSeriesView<number>(directionBuffer),
        }),
        valueBuffer,
        directionBuffer,
        deviation,
        depth,
        barCount: 0,
        direction: TREND_UNKNOWN,
        lastPivotPrice: Number.NaN,
        lastPivotIndex: -1,
        peakSinceLastPivot: Number.NaN,
        peakIndex: -1,
        prevClosedBarCount: 0,
        prevClosedDirection: TREND_UNKNOWN,
        prevClosedLastPivotPrice: Number.NaN,
        prevClosedLastPivotIndex: -1,
        prevClosedPeakSinceLastPivot: Number.NaN,
        prevClosedPeakIndex: -1,
    };
}

function snapshot(slot: ZigZagSlot): void {
    slot.prevClosedBarCount = slot.barCount;
    slot.prevClosedDirection = slot.direction;
    slot.prevClosedLastPivotPrice = slot.lastPivotPrice;
    slot.prevClosedLastPivotIndex = slot.lastPivotIndex;
    slot.prevClosedPeakSinceLastPivot = slot.peakSinceLastPivot;
    slot.prevClosedPeakIndex = slot.peakIndex;
}

/**
 * One step of the streaming ZigZag state machine. Returns the new
 * `(value, direction, lastPivotPrice, lastPivotIndex,
 * peakSinceLastPivot, peakIndex, direction)` state given the prior
 * state and this bar's `(close, barIndex)`. Used by both close-side
 * (which mutates the slot) and tick-side (which reads the snapshot,
 * does NOT mutate the slot).
 */
function recurrenceStep(
    close: number,
    barIndex: number,
    deviation: number,
    depth: number,
    prevDirection: Trend,
    prevLastPivotPrice: number,
    prevLastPivotIndex: number,
    prevPeakSinceLastPivot: number,
    prevPeakIndex: number,
): {
    value: number;
    direction: number;
    nextDirection: Trend;
    nextLastPivotPrice: number;
    nextLastPivotIndex: number;
    nextPeakSinceLastPivot: number;
    nextPeakIndex: number;
} {
    const pctChangeVsPivot = ((close - prevLastPivotPrice) / prevLastPivotPrice) * 100;
    const barsSincePivot = barIndex - prevLastPivotIndex;

    if (prevDirection === TREND_UNKNOWN) {
        // Pre-first-pivot: commit when |pct| crosses deviation AND
        // depth bars have elapsed since bar 0.
        if (
            Math.abs(pctChangeVsPivot) >= deviation &&
            barsSincePivot >= depth &&
            prevLastPivotPrice !== 0
        ) {
            const newDirection: Trend = pctChangeVsPivot > 0 ? TREND_UP : TREND_DOWN;
            return {
                value: close,
                direction: newDirection,
                nextDirection: newDirection,
                nextLastPivotPrice: close,
                nextLastPivotIndex: barIndex,
                nextPeakSinceLastPivot: close,
                nextPeakIndex: barIndex,
            };
        }
        return {
            value: Number.NaN,
            direction: Number.NaN,
            nextDirection: TREND_UNKNOWN,
            nextLastPivotPrice: prevLastPivotPrice,
            nextLastPivotIndex: prevLastPivotIndex,
            nextPeakSinceLastPivot: prevPeakSinceLastPivot,
            nextPeakIndex: prevPeakIndex,
        };
    }

    if (prevDirection === TREND_UP) {
        // Trending up: update running peak when price makes new high.
        if (close > prevPeakSinceLastPivot) {
            return {
                value: prevLastPivotPrice,
                direction: TREND_UP,
                nextDirection: TREND_UP,
                nextLastPivotPrice: prevLastPivotPrice,
                nextLastPivotIndex: prevLastPivotIndex,
                nextPeakSinceLastPivot: close,
                nextPeakIndex: barIndex,
            };
        }
        // Reversal candidate: price dropped by `deviation %` from the
        // running peak AND `depth` bars have elapsed since the peak.
        // Reaching the up-trend branch requires a prior up-commit
        // which set lastPivotPrice (and thus peak) from a finite,
        // non-zero close — so peak > 0 here.
        const pctDropFromPeak = ((prevPeakSinceLastPivot - close) / prevPeakSinceLastPivot) * 100;
        const barsSincePeak = barIndex - prevPeakIndex;
        if (pctDropFromPeak >= deviation && barsSincePeak >= depth) {
            // Confirm the running peak as the new pivot; flip
            // direction. The new lastPivot is the peak (NOT the
            // current close).
            return {
                value: prevPeakSinceLastPivot,
                direction: TREND_DOWN,
                nextDirection: TREND_DOWN,
                nextLastPivotPrice: prevPeakSinceLastPivot,
                nextLastPivotIndex: prevPeakIndex,
                nextPeakSinceLastPivot: close,
                nextPeakIndex: barIndex,
            };
        }
        // No new peak, no reversal — hold the current pivot.
        return {
            value: prevLastPivotPrice,
            direction: TREND_UP,
            nextDirection: TREND_UP,
            nextLastPivotPrice: prevLastPivotPrice,
            nextLastPivotIndex: prevLastPivotIndex,
            nextPeakSinceLastPivot: prevPeakSinceLastPivot,
            nextPeakIndex: prevPeakIndex,
        };
    }

    // prevDirection === TREND_DOWN.
    if (close < prevPeakSinceLastPivot) {
        return {
            value: prevLastPivotPrice,
            direction: TREND_DOWN,
            nextDirection: TREND_DOWN,
            nextLastPivotPrice: prevLastPivotPrice,
            nextLastPivotIndex: prevLastPivotIndex,
            nextPeakSinceLastPivot: close,
            nextPeakIndex: barIndex,
        };
    }
    // Down-trend reach: a prior down-flip OR commit-down set the
    // trough's source to a finite close. The trough CAN be 0 (commit-
    // up at 0 then flip-down at 0); the previous close was 0 so the
    // pctRise calc would divide by zero. Guard.
    const pctRiseFromTrough =
        prevPeakSinceLastPivot !== 0
            ? ((close - prevPeakSinceLastPivot) / prevPeakSinceLastPivot) * 100
            : 0;
    const barsSinceTrough = barIndex - prevPeakIndex;
    if (pctRiseFromTrough >= deviation && barsSinceTrough >= depth) {
        return {
            value: prevPeakSinceLastPivot,
            direction: TREND_UP,
            nextDirection: TREND_UP,
            nextLastPivotPrice: prevPeakSinceLastPivot,
            nextLastPivotIndex: prevPeakIndex,
            nextPeakSinceLastPivot: close,
            nextPeakIndex: barIndex,
        };
    }
    return {
        value: prevLastPivotPrice,
        direction: TREND_DOWN,
        nextDirection: TREND_DOWN,
        nextLastPivotPrice: prevLastPivotPrice,
        nextLastPivotIndex: prevLastPivotIndex,
        nextPeakSinceLastPivot: prevPeakSinceLastPivot,
        nextPeakIndex: prevPeakIndex,
    };
}

function closeStep(
    slot: ZigZagSlot,
    close: number,
    barIndex: number,
): { value: number; direction: number } {
    if (!Number.isFinite(close)) {
        // NaN close: freeze state. Snapshot is unchanged (covers tick
        // replay on the same NaN bar). Emit NaN/NaN.
        return { value: Number.NaN, direction: Number.NaN };
    }
    snapshot(slot);

    if (slot.barCount === 0) {
        // Seed bar — bar 0 is the candidate pivot, direction unknown.
        slot.barCount = 1;
        slot.lastPivotPrice = close;
        slot.lastPivotIndex = 0;
        slot.peakSinceLastPivot = close;
        slot.peakIndex = 0;
        slot.direction = TREND_UNKNOWN;
        return { value: Number.NaN, direction: Number.NaN };
    }

    const step = recurrenceStep(
        close,
        barIndex,
        slot.deviation,
        slot.depth,
        slot.direction,
        slot.lastPivotPrice,
        slot.lastPivotIndex,
        slot.peakSinceLastPivot,
        slot.peakIndex,
    );
    slot.barCount += 1;
    slot.direction = step.nextDirection;
    slot.lastPivotPrice = step.nextLastPivotPrice;
    slot.lastPivotIndex = step.nextLastPivotIndex;
    slot.peakSinceLastPivot = step.nextPeakSinceLastPivot;
    slot.peakIndex = step.nextPeakIndex;
    return { value: step.value, direction: step.direction };
}

function tickStep(
    slot: ZigZagSlot,
    close: number,
    barIndex: number,
): { value: number; direction: number } {
    if (!Number.isFinite(close)) {
        return { value: Number.NaN, direction: Number.NaN };
    }
    if (slot.prevClosedBarCount === 0) {
        // The current bar is the first closed bar — its tick replay
        // is the seed itself (NaN, NaN).
        return { value: Number.NaN, direction: Number.NaN };
    }
    const step = recurrenceStep(
        close,
        barIndex,
        slot.deviation,
        slot.depth,
        slot.prevClosedDirection,
        slot.prevClosedLastPivotPrice,
        slot.prevClosedLastPivotIndex,
        slot.prevClosedPeakSinceLastPivot,
        slot.prevClosedPeakIndex,
    );
    return { value: step.value, direction: step.direction };
}

/**
 * ZigZag — streaming swing-pivot detector. Walks the close series
 * tracking a running candidate pivot; confirms a new pivot when the
 * price has reversed by at least `deviation %` from the candidate
 * AND `depth` bars have elapsed. The output `value` Series carries
 * the price of the most-recently-confirmed pivot (held constant
 * between confirmations); `direction` is `+1` (uptrend), `-1`
 * (downtrend), or NaN before the first confirmation. Returns a
 * cached `{ value, direction }` record (same identity every bar).
 *
 * Streaming adaptation of invinite's batch ZigZag: invinite paints
 * a linearly-interpolated polyline between confirmed pivots and
 * supports `extendToLastBar` retro-painting from the last confirmed
 * pivot to the right edge. The append-only Series model cannot
 * rewrite older slots, so the streaming output is the closest
 * representable surface (a "trailing reference level" Pine authors
 * would use as a stop). Defaults: `deviation = 5`, `depth = 10`.
 *
 * NaN close → NaN outputs and freezes the state machine. Tick-mode
 * replays the head from the snapshot captured at the start of the
 * current bar (mirrors PSAR / Supertrend).
 *
 * @formula  Confirm pivot when |Δ%| ≥ deviation AND barsSince ≥ depth :
 *           up-trend: running peak updates on new highs ; flip on
 *           |drop from peak| ≥ deviation ; flip-direction emits the
 *           peak (the just-confirmed top) as `value`, sets new
 *           `direction = −1`. Down-trend symmetric.
 * @warmup   input-dependent (NaN until first confirmed pivot)
 * @anchors  deviation, depth
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const z = ta.zigZag({ deviation: 5 });
 *     // plot(z.value);
 */
export function zigZag(slotId: string, opts?: ZigZagOpts): ZigZagResult {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as ZigZagSlot | undefined;
    if (slot === undefined) {
        const deviation = opts?.deviation ?? DEFAULT_DEVIATION;
        const depth = opts?.depth ?? DEFAULT_DEPTH;
        slot = initSlot(ctx.stream.ohlcv.close.capacity, deviation, depth);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const close = ctx.stream.bar.close;
    if (ctx.isTick) {
        // Tick replay uses the snapshot's barCount as the current-bar
        // index (the close-side incremented barCount AFTER taking the
        // snapshot, so the snapshot's barCount equals the index of
        // THIS bar).
        const barIndexForStep = slot.prevClosedBarCount;
        const { value, direction } = tickStep(slot, close, barIndexForStep);
        slot.valueBuffer.replaceHead(value);
        slot.directionBuffer.replaceHead(direction);
    } else {
        // Close-side uses slot.barCount (pre-increment in this close)
        // — the bar's 0-based index. Snapshot/seed branch handles
        // barCount === 0 explicitly.
        const barIndexForStep = slot.barCount;
        const { value, direction } = closeStep(slot, close, barIndexForStep);
        slot.valueBuffer.append(value);
        slot.directionBuffer.append(direction);
    }
    return slot.outputs;
}
