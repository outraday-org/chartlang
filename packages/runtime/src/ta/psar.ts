// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/psar.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. PSAR reads `bar.high` / `bar.low` /
// `bar.close` directly (mirrors Pine's `ta.psar` which has no source
// param). The recurrence runs incrementally one bar at a time;
// tick-mode replays the recurrence from a per-bar snapshot of the
// state at the start of the current bar so a partial-bar tick doesn't
// pollute the next close's flip detection.

import type { PsarOpts, PsarResult } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView } from "../seriesView";

const DEFAULT_ACC_START = 0.02;
const DEFAULT_ACC_STEP = 0.02;
const DEFAULT_ACC_MAX = 0.2;

const TREND_UP = 1;
const TREND_DOWN = -1;

type Trend = 1 | -1;

type PsarSlot = {
    readonly outputs: PsarResult;
    readonly sarBuffer: Float64RingBuffer;
    readonly directionBuffer: Float64RingBuffer;
    readonly accStart: number;
    readonly accStep: number;
    readonly accMax: number;
    /** Number of CLOSED bars folded into the slot so far. */
    barCount: number;
    // Live recurrence state — advanced on every close, snapshotted to
    // `prevClosed*` BEFORE the close runs the recurrence so a final
    // tick can replay from the seed.
    trend: Trend;
    ep: number;
    af: number;
    sar: number;
    /** Most recent CLOSED bar's high (i.e. bar at index `barCount - 1`). */
    prevHigh: number;
    /** Most recent CLOSED bar's low. */
    prevLow: number;
    /** The bar BEFORE prevHigh — i.e. the high 2 bars ago. */
    priorHigh: number;
    /** The bar BEFORE prevLow — i.e. the low 2 bars ago. */
    priorLow: number;
    /** The close of the most recent CLOSED bar — used by bar-1's
     * direction-decide step on the NEXT close (this is "prevClose"). */
    prevClose: number;
    // Snapshot-at-start-of-current-bar — captured each close BEFORE
    // the recurrence advances the live fields. Tick replays from
    // these so the next close sees the original seed.
    prevClosedTrend: Trend;
    prevClosedEp: number;
    prevClosedAf: number;
    prevClosedSar: number;
    prevClosedPrevHigh: number;
    prevClosedPrevLow: number;
    prevClosedPriorHigh: number;
    prevClosedPriorLow: number;
    prevClosedPrevClose: number;
    prevClosedBarCount: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.psar called outside an active script step");
    }
    return ctx;
}

function initSlot(capacity: number, accStart: number, accStep: number, accMax: number): PsarSlot {
    const sarBuffer = new Float64RingBuffer(capacity);
    const directionBuffer = new Float64RingBuffer(capacity);
    return {
        outputs: Object.freeze({
            sar: makeSeriesView<number>(sarBuffer),
            direction: makeSeriesView<number>(directionBuffer),
        }),
        sarBuffer,
        directionBuffer,
        accStart,
        accStep,
        accMax,
        barCount: 0,
        trend: TREND_UP,
        ep: Number.NaN,
        af: accStart,
        sar: Number.NaN,
        prevHigh: Number.NaN,
        prevLow: Number.NaN,
        priorHigh: Number.NaN,
        priorLow: Number.NaN,
        prevClose: Number.NaN,
        prevClosedTrend: TREND_UP,
        prevClosedEp: Number.NaN,
        prevClosedAf: accStart,
        prevClosedSar: Number.NaN,
        prevClosedPrevHigh: Number.NaN,
        prevClosedPrevLow: Number.NaN,
        prevClosedPriorHigh: Number.NaN,
        prevClosedPriorLow: Number.NaN,
        prevClosedPrevClose: Number.NaN,
        prevClosedBarCount: 0,
    };
}

function snapshot(slot: PsarSlot): void {
    slot.prevClosedTrend = slot.trend;
    slot.prevClosedEp = slot.ep;
    slot.prevClosedAf = slot.af;
    slot.prevClosedSar = slot.sar;
    slot.prevClosedPrevHigh = slot.prevHigh;
    slot.prevClosedPrevLow = slot.prevLow;
    slot.prevClosedPriorHigh = slot.priorHigh;
    slot.prevClosedPriorLow = slot.priorLow;
    slot.prevClosedPrevClose = slot.prevClose;
    slot.prevClosedBarCount = slot.barCount;
}

/**
 * Run one bar of the recurrence given the prior CLOSED-bar state
 * (`prevTrend` / `prevEp` / `prevAf` / `prevSar` / `prevHigh` /
 * `prevLow` / `priorHigh` / `priorLow`) and the new bar's
 * `high` / `low`. Returns `{ trend, ep, af, sar }` for the new bar.
 * Used by both the close-side advance and the tick-side replay.
 */
function recurrenceStep(
    prevTrend: Trend,
    prevEp: number,
    prevAf: number,
    prevSar: number,
    prevHigh: number,
    prevLow: number,
    priorHigh: number,
    priorLow: number,
    high: number,
    low: number,
    accStart: number,
    accStep: number,
    accMax: number,
): { trend: Trend; ep: number; af: number; sar: number } {
    let candidateSar = prevSar + prevAf * (prevEp - prevSar);

    if (prevTrend === TREND_UP) {
        const lowerBound = Math.min(prevLow, priorLow);
        if (candidateSar > lowerBound) candidateSar = lowerBound;

        if (low <= candidateSar) {
            // Flip to downtrend: SAR becomes the prior EP, new EP is
            // this bar's low, AF resets.
            return { trend: TREND_DOWN, ep: low, af: accStart, sar: prevEp };
        }
        let ep = prevEp;
        let af = prevAf;
        if (high > prevEp) {
            ep = high;
            af = Math.min(prevAf + accStep, accMax);
        }
        return { trend: TREND_UP, ep, af, sar: candidateSar };
    }

    // prevTrend === TREND_DOWN
    const upperBound = Math.max(prevHigh, priorHigh);
    if (candidateSar < upperBound) candidateSar = upperBound;

    if (high >= candidateSar) {
        return { trend: TREND_UP, ep: high, af: accStart, sar: prevEp };
    }
    let ep = prevEp;
    let af = prevAf;
    if (low < prevEp) {
        ep = low;
        af = Math.min(prevAf + accStep, accMax);
    }
    return { trend: TREND_DOWN, ep, af, sar: candidateSar };
}

function closeStep(
    slot: PsarSlot,
    high: number,
    low: number,
    close: number,
): { sar: number; direction: number } {
    // NaN suspends state: do not advance any of the live recurrence
    // fields. The snapshot remains the prior bar's state so the next
    // finite close picks up exactly where the last finite close left
    // off.
    if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
        return { sar: Number.NaN, direction: Number.NaN };
    }

    // Snapshot the live state BEFORE any mutation so a tick-mode
    // replay (which arrives AFTER the close-side advance for the
    // same bar) sees the start-of-bar state.
    snapshot(slot);
    slot.barCount += 1;

    // First finite bar: seed slot. Invinite uses
    // `sar[0] = candles[0].low`, `trend[0] = TREND_UP`. The internal
    // recurrence state is initialised to `ep = high` (the initial
    // EP for an up-trend), `af = accStart`, with `prevHigh / prevLow
    // / priorHigh / priorLow` all set to this bar's H/L (no bar -1).
    if (slot.prevClosedBarCount === 0) {
        slot.trend = TREND_UP;
        slot.sar = low;
        slot.ep = high;
        slot.af = slot.accStart;
        slot.prevHigh = high;
        slot.prevLow = low;
        slot.priorHigh = high;
        slot.priorLow = low;
        slot.prevClose = close;
        return { sar: low, direction: TREND_UP };
    }

    // Second finite bar: decide initial direction by comparing this
    // bar's close to the prior CLOSED bar's close. Re-seed `ep` and
    // `sar` per the chosen direction.
    if (slot.prevClosedBarCount === 1) {
        const direction: Trend = close >= slot.prevClose ? TREND_UP : TREND_DOWN;
        slot.trend = direction;
        if (direction === TREND_UP) {
            slot.ep = high;
            slot.sar = slot.prevLow;
        } else {
            slot.ep = low;
            slot.sar = slot.prevHigh;
        }
        slot.af = slot.accStart;
        // Now run the recurrence for this bar starting from the just-
        // re-seeded `(trend, ep, af, sar)` with priorH/L = prevH/L
        // (only one prior bar exists).
        const step = recurrenceStep(
            slot.trend,
            slot.ep,
            slot.af,
            slot.sar,
            slot.prevHigh,
            slot.prevLow,
            slot.prevHigh,
            slot.prevLow,
            high,
            low,
            slot.accStart,
            slot.accStep,
            slot.accMax,
        );
        slot.trend = step.trend;
        slot.ep = step.ep;
        slot.af = step.af;
        slot.sar = step.sar;
        // Shift the look-back window forward.
        slot.priorHigh = slot.prevHigh;
        slot.priorLow = slot.prevLow;
        slot.prevHigh = high;
        slot.prevLow = low;
        slot.prevClose = close;
        return { sar: step.sar, direction: step.trend };
    }

    // Third finite bar onward: standard recurrence.
    const step = recurrenceStep(
        slot.trend,
        slot.ep,
        slot.af,
        slot.sar,
        slot.prevHigh,
        slot.prevLow,
        slot.priorHigh,
        slot.priorLow,
        high,
        low,
        slot.accStart,
        slot.accStep,
        slot.accMax,
    );
    slot.trend = step.trend;
    slot.ep = step.ep;
    slot.af = step.af;
    slot.sar = step.sar;
    slot.priorHigh = slot.prevHigh;
    slot.priorLow = slot.prevLow;
    slot.prevHigh = high;
    slot.prevLow = low;
    slot.prevClose = close;
    return { sar: step.sar, direction: step.trend };
}

function tickStep(
    slot: PsarSlot,
    high: number,
    low: number,
    close: number,
): { sar: number; direction: number } {
    if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
        return { sar: Number.NaN, direction: Number.NaN };
    }
    // Replay from the snapshot taken at the start of the current
    // CLOSED bar. The snapshot's `prevClosedBarCount` tells us which
    // branch of `closeStep` to mirror.
    const seedBarCount = slot.prevClosedBarCount;
    if (seedBarCount === 0) {
        // The current bar is the FIRST closed bar — its tick replay
        // is the seed itself, with the tick's low as the sar.
        return { sar: low, direction: TREND_UP };
    }
    if (seedBarCount === 1) {
        const direction: Trend = close >= slot.prevClosedPrevClose ? TREND_UP : TREND_DOWN;
        let ep: number;
        let sar: number;
        if (direction === TREND_UP) {
            ep = high;
            sar = slot.prevClosedPrevLow;
        } else {
            ep = low;
            sar = slot.prevClosedPrevHigh;
        }
        const af = slot.accStart;
        const step = recurrenceStep(
            direction,
            ep,
            af,
            sar,
            slot.prevClosedPrevHigh,
            slot.prevClosedPrevLow,
            slot.prevClosedPrevHigh,
            slot.prevClosedPrevLow,
            high,
            low,
            slot.accStart,
            slot.accStep,
            slot.accMax,
        );
        return { sar: step.sar, direction: step.trend };
    }
    const step = recurrenceStep(
        slot.prevClosedTrend,
        slot.prevClosedEp,
        slot.prevClosedAf,
        slot.prevClosedSar,
        slot.prevClosedPrevHigh,
        slot.prevClosedPrevLow,
        slot.prevClosedPriorHigh,
        slot.prevClosedPriorLow,
        high,
        low,
        slot.accStart,
        slot.accStep,
        slot.accMax,
    );
    return { sar: step.sar, direction: step.trend };
}

/**
 * Parabolic SAR — Wilder's classic stop-and-reverse oscillator with
 * extreme-point + acceleration-factor tracking. Reads `bar.high` /
 * `bar.low` / `bar.close` directly (no `source` arg — mirrors Pine).
 * Returns a cached `{ sar, direction }` record (same identity every
 * bar). `direction` is `+1` (uptrend) / `-1` (downtrend), NaN during
 * NaN-suspension. Warmup is `1` — bar 0 emits the seed value
 * (`sar = bar.low`, `direction = +1`); bar 1 decides the initial
 * direction from `close[1] >= close[0]` and runs the recurrence; bar
 * 2+ continues the recurrence.
 *
 * NaN inputs SUSPEND the recurrence: any non-finite OHL emits NaN /
 * NaN and freezes the live state so the next finite bar resumes from
 * the prior state. Replay-mode (`replaceHead`) recomputes from the
 * snapshot captured at the start of the current bar, so a final tick
 * cannot poison the next close's seed.
 *
 * @formula  candidateSar = prevSar + prevAf · (prevEp − prevSar) ;
 *           up-trend clamp: candidateSar ≤ min(prevLow, priorLow) ;
 *           down-trend clamp: candidateSar ≥ max(prevHigh, priorHigh) ;
 *           flip (up→down): bar.low ≤ candidateSar → sar = prevEp, ep = low, af = accStart ;
 *           flip (down→up): bar.high ≥ candidateSar → sar = prevEp, ep = high, af = accStart ;
 *           EP advance: new extreme widens ep, af = min(af + accStep, accMax)
 * @warmup   1
 * @anchors  accelerationStart, accelerationStep, accelerationMax
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const p = ta.psar({ accelerationStart: 0.02, accelerationStep: 0.02, accelerationMax: 0.2 });
 *     // plot(p.sar);
 */
export function psar(slotId: string, opts?: PsarOpts): PsarResult {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as PsarSlot | undefined;
    if (slot === undefined) {
        const accStart = opts?.accelerationStart ?? DEFAULT_ACC_START;
        const accStep = opts?.accelerationStep ?? DEFAULT_ACC_STEP;
        const accMax = opts?.accelerationMax ?? DEFAULT_ACC_MAX;
        slot = initSlot(ctx.stream.ohlcv.close.capacity, accStart, accStep, accMax);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const high = ctx.stream.bar.high;
    const low = ctx.stream.bar.low;
    const close = ctx.stream.bar.close;
    if (ctx.isTick) {
        const { sar, direction } = tickStep(slot, high, low, close);
        slot.sarBuffer.replaceHead(sar);
        slot.directionBuffer.replaceHead(direction);
    } else {
        const { sar, direction } = closeStep(slot, high, low, close);
        slot.sarBuffer.append(sar);
        slot.directionBuffer.append(direction);
    }
    return slot.outputs;
}
