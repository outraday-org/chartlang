// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/supertrend.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. Supertrend composes Phase-1 `ta.atr` at
// sub-slot `${slotId}/atr`, so a fix to ATR flows in for free. The
// source is hard-coded to `hl2` (Pine-canonical Supertrend); a
// `source` opt could land in a follow-up.

import type { Series, SupertrendOpts, SupertrendResult } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView } from "../seriesView.js";
import { atr } from "./atr.js";

const DEFAULT_LENGTH = 10;
const DEFAULT_MULTIPLIER = 3;

const TREND_UP = 1;
const TREND_DOWN = -1;

type Trend = 1 | -1;

type SupertrendSlot = {
    readonly outputs: SupertrendResult;
    readonly lineBuffer: Float64RingBuffer;
    readonly directionBuffer: Float64RingBuffer;
    readonly length: number;
    readonly multiplier: number;
    /** Number of CLOSED bars folded into the slot WITH FINITE ATR
     * so far — i.e. bars where the Supertrend recurrence advanced. */
    warmBarCount: number;
    // Live recurrence state.
    prevFinalUpper: number;
    prevFinalLower: number;
    prevDirection: Trend;
    /** Close of the most recent CLOSED bar — feeds the
     * `close[i - 1] > finalUpper[i - 1]` clamp in the next close. */
    prevClose: number;
    // Snapshot-at-start-of-current-bar — captured each close BEFORE
    // the recurrence advances so a final tick replays from the seed.
    prevClosedFinalUpper: number;
    prevClosedFinalLower: number;
    prevClosedDirection: Trend;
    /** Close of the bar BEFORE the current bar — i.e. the close
     * 2 bars ago at the start of this bar. */
    prevClosedPrevClose: number;
    prevClosedWarmBarCount: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.supertrend called outside an active script step");
    }
    return ctx;
}

function initSlot(capacity: number, length: number, multiplier: number): SupertrendSlot {
    const lineBuffer = new Float64RingBuffer(capacity);
    const directionBuffer = new Float64RingBuffer(capacity);
    return {
        outputs: Object.freeze({
            line: makeSeriesView<number>(lineBuffer),
            direction: makeSeriesView<number>(directionBuffer),
        }),
        lineBuffer,
        directionBuffer,
        length,
        multiplier,
        warmBarCount: 0,
        prevFinalUpper: Number.NaN,
        prevFinalLower: Number.NaN,
        prevDirection: TREND_UP,
        prevClose: Number.NaN,
        prevClosedFinalUpper: Number.NaN,
        prevClosedFinalLower: Number.NaN,
        prevClosedDirection: TREND_UP,
        prevClosedPrevClose: Number.NaN,
        prevClosedWarmBarCount: 0,
    };
}

function snapshot(slot: SupertrendSlot): void {
    slot.prevClosedFinalUpper = slot.prevFinalUpper;
    slot.prevClosedFinalLower = slot.prevFinalLower;
    slot.prevClosedDirection = slot.prevDirection;
    slot.prevClosedPrevClose = slot.prevClose;
    slot.prevClosedWarmBarCount = slot.warmBarCount;
}

/**
 * One step of the Supertrend recurrence given the snapshot of the
 * prior CLOSED bar's `(finalUpper, finalLower, direction, prevClose)`
 * and this bar's `mid` / `atr` / `close`. Returns the new
 * `(finalUpper, finalLower, direction, line)`. Used by both close
 * and tick. Caller decides whether to seed (first warm bar) or run
 * the recurrence based on the snapshot's `warmBarCount`.
 */
function recurrenceStep(
    mid: number,
    atrValue: number,
    close: number,
    multiplier: number,
    prevFinalUpper: number,
    prevFinalLower: number,
    prevDirection: Trend,
    prevClose: number,
): { finalUpper: number; finalLower: number; direction: Trend; line: number } {
    const basicUpper = mid + multiplier * atrValue;
    const basicLower = mid - multiplier * atrValue;
    const finalUpper =
        basicUpper < prevFinalUpper || prevClose > prevFinalUpper ? basicUpper : prevFinalUpper;
    const finalLower =
        basicLower > prevFinalLower || prevClose < prevFinalLower ? basicLower : prevFinalLower;
    let direction: Trend = prevDirection;
    if (close > prevFinalUpper) {
        direction = TREND_UP;
    } else if (close < prevFinalLower) {
        direction = TREND_DOWN;
    }
    const line = direction === TREND_UP ? finalLower : finalUpper;
    return { finalUpper, finalLower, direction, line };
}

function closeStep(
    slot: SupertrendSlot,
    mid: number,
    atrValue: number,
    close: number,
): { line: number; direction: number } {
    // NaN inputs (incl. NaN ATR during warmup) freeze state.
    if (!Number.isFinite(mid) || !Number.isFinite(atrValue) || !Number.isFinite(close)) {
        return { line: Number.NaN, direction: Number.NaN };
    }
    snapshot(slot);
    slot.warmBarCount += 1;

    // First warm bar: seed. Set finalUpper / finalLower from the
    // basic bands, direction = +1, line = finalLower. (Matches
    // invinite's `supertrend.ts:99-111`.)
    if (slot.prevClosedWarmBarCount === 0) {
        const basicUpper = mid + slot.multiplier * atrValue;
        const basicLower = mid - slot.multiplier * atrValue;
        slot.prevFinalUpper = basicUpper;
        slot.prevFinalLower = basicLower;
        slot.prevDirection = TREND_UP;
        slot.prevClose = close;
        return { line: basicLower, direction: TREND_UP };
    }

    const step = recurrenceStep(
        mid,
        atrValue,
        close,
        slot.multiplier,
        slot.prevFinalUpper,
        slot.prevFinalLower,
        slot.prevDirection,
        slot.prevClose,
    );
    slot.prevFinalUpper = step.finalUpper;
    slot.prevFinalLower = step.finalLower;
    slot.prevDirection = step.direction;
    slot.prevClose = close;
    return { line: step.line, direction: step.direction };
}

function tickStep(
    slot: SupertrendSlot,
    mid: number,
    atrValue: number,
    close: number,
): { line: number; direction: number } {
    if (!Number.isFinite(mid) || !Number.isFinite(atrValue) || !Number.isFinite(close)) {
        return { line: Number.NaN, direction: Number.NaN };
    }
    // Replay from snapshot.
    if (slot.prevClosedWarmBarCount === 0) {
        // The current bar is the FIRST warm bar — its tick replay
        // re-derives the seed (line = finalLower, direction = +1).
        const basicLower = mid - slot.multiplier * atrValue;
        return { line: basicLower, direction: TREND_UP };
    }
    const step = recurrenceStep(
        mid,
        atrValue,
        close,
        slot.multiplier,
        slot.prevClosedFinalUpper,
        slot.prevClosedFinalLower,
        slot.prevClosedDirection,
        slot.prevClosedPrevClose,
    );
    return { line: step.line, direction: step.direction };
}

/**
 * Supertrend — ATR-driven trailing-stop trend follower. Computes
 * `basicUpper / basicLower = hl2 ± multiplier · atr(length)` per
 * bar, smooths to `finalUpper / finalLower` via the standard
 * persistence rule (carry forward unless the prior close pierced
 * the band), and emits a single `line` Series equal to the active
 * final band for the current direction. `direction` flips when
 * `close` crosses the prior `finalUpper` (→ `+1`) or `finalLower`
 * (→ `-1`). Composes `ta.atr` at sub-slot `${slotId}/atr`.
 *
 * NaN ATR (warmup or NaN-propagation) → NaN outputs; local state
 * freezes so the next finite bar resumes from the prior closed
 * state. Returns a cached `{ line, direction }` record
 * (same identity every bar). Warmup is `length` — the same as
 * `ta.atr`'s warmup, since Supertrend cannot run until ATR is warm.
 *
 * @formula  basicUpper = hl2 + multiplier · atr ;
 *           basicLower = hl2 − multiplier · atr ;
 *           finalUpper = basicUpper < prevFinalUpper || prevClose > prevFinalUpper ? basicUpper : prevFinalUpper ;
 *           finalLower = basicLower > prevFinalLower || prevClose < prevFinalLower ? basicLower : prevFinalLower ;
 *           direction  = close > prevFinalUpper ? +1 : close < prevFinalLower ? −1 : prevDirection ;
 *           line       = direction === +1 ? finalLower : finalUpper
 * @warmup   length
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const s = ta.supertrend({ length: 10, multiplier: 3 });
 *     // plot(s.line);
 */
export function supertrend(slotId: string, opts?: SupertrendOpts): SupertrendResult {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as SupertrendSlot | undefined;
    if (slot === undefined) {
        const length = opts?.length ?? DEFAULT_LENGTH;
        const multiplier = opts?.multiplier ?? DEFAULT_MULTIPLIER;
        slot = initSlot(ctx.stream.ohlcv.close.capacity, length, multiplier);
        ctx.stream.taSlots.set(slotId, slot);
    }
    // Compose: ta.atr at a sub-slot. The composed call routes
    // through the registry and respects ctx.isTick automatically.
    const atrSeries: Series<number> = atr(`${slotId}/atr`, slot.length);
    // `bar.hl2` / `bar.close` are number-coercible series-view proxies — coerce
    // at the read so the step helpers see real numbers, not a proxy.
    const mid = +ctx.stream.bar.hl2;
    const atrValue = atrSeries.current;
    const close = +ctx.stream.bar.close;
    if (ctx.isTick) {
        const { line, direction } = tickStep(slot, mid, atrValue, close);
        slot.lineBuffer.replaceHead(line);
        slot.directionBuffer.replaceHead(direction);
    } else {
        const { line, direction } = closeStep(slot, mid, atrValue, close);
        slot.lineBuffer.append(line);
        slot.directionBuffer.append(direction);
    }
    return slot.outputs;
}
