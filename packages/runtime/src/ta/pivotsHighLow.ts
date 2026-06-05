// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/pivots-high-low.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. Pivots H/L is self-contained — no
// composition with `ta.highest` / `ta.lowest` because the centre bar
// must be EXCLUDED from the windowed strict-extreme comparison AND
// the tie-break differs between sides (strict-greater on the LEFT,
// geq on the RIGHT for highs; matches TradingView `ta.pivothigh`).
// The slot owns a `leftLength + rightLength + 1` ring buffer per
// side (high / low) and scans it per close. Output deviates from
// the typical line-style timing in that the value at bar `t`
// describes bar `c = t − rightLength` (mirrors Williams Fractal's
// centred-window convention from Task 26).

import type { PivotsHighLowOpts, PivotsHighLowResult } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView } from "../seriesView";

const DEFAULT_LEFT = 4;
const DEFAULT_RIGHT = 4;

type PivotsHighLowSlot = {
    readonly outputs: PivotsHighLowResult;
    readonly highBuffer: Float64RingBuffer;
    readonly lowBuffer: Float64RingBuffer;
    readonly leftLength: number;
    readonly rightLength: number;
    /**
     * Trailing `leftLength + rightLength + 1` highs. `at(0)` is the
     * most recent close (right-window head); `at(rightLength)` is the
     * centre bar; `at(leftLength + rightLength)` is the oldest
     * left-window bar.
     */
    readonly highWindow: Float64RingBuffer;
    /** Trailing `leftLength + rightLength + 1` lows. */
    readonly lowWindow: Float64RingBuffer;
    /** Number of CLOSED bars folded into the slot so far. */
    barCount: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.pivotsHighLow called outside an active script step");
    }
    return ctx;
}

function initSlot(capacity: number, leftLength: number, rightLength: number): PivotsHighLowSlot {
    const highBuffer = new Float64RingBuffer(capacity);
    const lowBuffer = new Float64RingBuffer(capacity);
    const windowSize = leftLength + rightLength + 1;
    return {
        outputs: Object.freeze({
            high: makeSeriesView<number>(highBuffer),
            low: makeSeriesView<number>(lowBuffer),
        }),
        highBuffer,
        lowBuffer,
        leftLength,
        rightLength,
        highWindow: new Float64RingBuffer(windowSize),
        lowWindow: new Float64RingBuffer(windowSize),
        barCount: 0,
    };
}

/**
 * Scan the centred window for an up-pivot at the centre bar (age
 * `rightLength`). Returns `centreHigh` if the centre's high is
 * strictly greater than every left-side bar AND greater-or-equal to
 * every right-side bar (matches Pine `ta.pivothigh` tie-break —
 * equal-high plateaus resolve to the LATER bar). Returns NaN if any
 * window entry is NaN or the strict/geq check fails. `headHigh` is
 * the substitute for age 0 (the most recent bar); tick replay
 * passes the tick's high there.
 */
function scanUpPivot(
    highWindow: Float64RingBuffer,
    headHigh: number,
    leftLength: number,
    rightLength: number,
): number {
    const centreAge = rightLength;
    const centreHigh = highWindow.at(centreAge);
    if (!Number.isFinite(centreHigh)) return Number.NaN;
    // Right-side window: ages 0..rightLength-1. Strict-or-equal: any
    // right-side bar with strictly greater high → not a pivot.
    for (let k = 0; k < rightLength; k += 1) {
        const v = k === 0 ? headHigh : highWindow.at(k);
        if (!Number.isFinite(v)) return Number.NaN;
        if (v > centreHigh) return Number.NaN;
    }
    // Left-side window: ages centreAge+1..centreAge+leftLength.
    // Strict: any left-side bar with greater-or-equal high → not a
    // pivot.
    for (let k = centreAge + 1; k <= centreAge + leftLength; k += 1) {
        const v = highWindow.at(k);
        if (!Number.isFinite(v)) return Number.NaN;
        if (v >= centreHigh) return Number.NaN;
    }
    return centreHigh;
}

/**
 * Scan the centred window for a down-pivot at the centre bar.
 * Mirrors {@link scanUpPivot} with `<` / `centreLow` (strict-less
 * on left, leq on right).
 */
function scanDownPivot(
    lowWindow: Float64RingBuffer,
    headLow: number,
    leftLength: number,
    rightLength: number,
): number {
    const centreAge = rightLength;
    const centreLow = lowWindow.at(centreAge);
    if (!Number.isFinite(centreLow)) return Number.NaN;
    for (let k = 0; k < rightLength; k += 1) {
        const v = k === 0 ? headLow : lowWindow.at(k);
        if (!Number.isFinite(v)) return Number.NaN;
        if (v < centreLow) return Number.NaN;
    }
    for (let k = centreAge + 1; k <= centreAge + leftLength; k += 1) {
        const v = lowWindow.at(k);
        if (!Number.isFinite(v)) return Number.NaN;
        if (v <= centreLow) return Number.NaN;
    }
    return centreLow;
}

/**
 * Pivots High Low — centred-window swing-pivot detector with
 * asymmetric `(leftLength, rightLength)` confirmation windows. For
 * each centre bar `c`, marks an **up-pivot** if `bar.high(c)` is
 * strictly greater than every `bar.high` in the `leftLength`-bar
 * left window AND greater-or-equal to every `bar.high` in the
 * `rightLength`-bar right window (matches Pine `ta.pivothigh`
 * tie-break — equal-high plateaus resolve to the LATER bar).
 * Mirrors for **down-pivot** with `bar.low` (strict-less on left,
 * leq on right).
 *
 * Output is centred — at live bar `t`, the value emitted at
 * `high.current` / `low.current` is the pivot status of bar `t −
 * rightLength` (when bar `t` closes, we now have enough right-
 * window bars to confirm bar `t − rightLength`). The most recent
 * `rightLength` slots of each Series are intentionally NaN
 * (pending right-window confirmation). Warmup is `leftLength +
 * rightLength` bars before the first confirmed centre.
 *
 * Outputs encode **price levels**: `high.current` =
 * `bar.high(centre)` when up-pivot, NaN otherwise; `low.current` =
 * `bar.low(centre)` when down-pivot, NaN otherwise. NaN in any
 * window slot → no pivot at the centre. Returns a cached `{ high,
 * low }` record (same identity every bar).
 *
 * @formula  high = bar.high(centre) when bar.high(centre) > every left high AND ≥ every right high, NaN otherwise ;
 *           low  = bar.low(centre)  when bar.low(centre)  < every left low  AND ≤ every right low,  NaN otherwise
 * @warmup   leftLength + rightLength
 * @anchors  leftLength, rightLength
 * @since 0.2
 * @experimental
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const p = ta.pivotsHighLow({ leftLength: 4, rightLength: 4 });
 *     // plot(p.high);
 *     // plot(p.low);
 */
export function pivotsHighLow(slotId: string, opts?: PivotsHighLowOpts): PivotsHighLowResult {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as PivotsHighLowSlot | undefined;
    if (slot === undefined) {
        const leftLength = opts?.leftLength ?? DEFAULT_LEFT;
        const rightLength = opts?.rightLength ?? DEFAULT_RIGHT;
        slot = initSlot(ctx.stream.ohlcv.close.capacity, leftLength, rightLength);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const bar = ctx.stream.bar;
    const windowSize = slot.leftLength + slot.rightLength + 1;

    if (ctx.isTick) {
        // Tick: substitute head (age 0) with the tick's high/low; centre
        // is still at age `rightLength` in the closed window. Warmup
        // requires `barCount >= windowSize`.
        if (slot.barCount < windowSize) {
            slot.highBuffer.replaceHead(Number.NaN);
            slot.lowBuffer.replaceHead(Number.NaN);
        } else {
            slot.highBuffer.replaceHead(
                scanUpPivot(slot.highWindow, bar.high, slot.leftLength, slot.rightLength),
            );
            slot.lowBuffer.replaceHead(
                scanDownPivot(slot.lowWindow, bar.low, slot.leftLength, slot.rightLength),
            );
        }
    } else {
        slot.highWindow.append(bar.high);
        slot.lowWindow.append(bar.low);
        slot.barCount += 1;
        if (slot.barCount < windowSize) {
            slot.highBuffer.append(Number.NaN);
            slot.lowBuffer.append(Number.NaN);
        } else {
            // Close-side: head (age 0) IS this bar's high/low — pass
            // `headHigh = highWindow.at(0)` (no substitution).
            slot.highBuffer.append(
                scanUpPivot(
                    slot.highWindow,
                    slot.highWindow.at(0),
                    slot.leftLength,
                    slot.rightLength,
                ),
            );
            slot.lowBuffer.append(
                scanDownPivot(
                    slot.lowWindow,
                    slot.lowWindow.at(0),
                    slot.leftLength,
                    slot.rightLength,
                ),
            );
        }
    }
    return slot.outputs;
}
