// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/pivots-standard.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. Pivots Standard is self-contained — no
// composition. Session boundaries are detected from `bar.time` via
// `Math.floor(bar.time / 86_400_000)` (UTC-day key). Invinite's
// full session-detection machinery (weekly / monthly / yearly /
// custom session ranges) is reduced to daily-only here — Phase 2
// ships daily pivots; broader session support could land in a
// follow-up. Six published formula systems are reduced to four
// (classic / fibonacci / camarilla / woodie) per task §1; DeMark
// and Traditional defer. R4 / R5 / S4 / S5 defer per the Phase-2
// README "Deferred / Follow-Up Work" footnote.

import type {
    PivotsStandardOpts,
    PivotsStandardResult,
    PivotsStandardSystem,
} from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView } from "../seriesView.js";

const DEFAULT_SYSTEM: PivotsStandardSystem = "classic";

const MS_PER_DAY = 86_400_000;

type SevenLevels = {
    pp: number;
    r1: number;
    s1: number;
    r2: number;
    s2: number;
    r3: number;
    s3: number;
};

type PivotsStandardSlot = {
    readonly outputs: PivotsStandardResult;
    readonly ppBuffer: Float64RingBuffer;
    readonly r1Buffer: Float64RingBuffer;
    readonly s1Buffer: Float64RingBuffer;
    readonly r2Buffer: Float64RingBuffer;
    readonly s2Buffer: Float64RingBuffer;
    readonly r3Buffer: Float64RingBuffer;
    readonly s3Buffer: Float64RingBuffer;
    readonly system: PivotsStandardSystem;
    // Live state.
    barCount: number;
    currentDayKey: number;
    currentDayHigh: number;
    currentDayLow: number;
    currentDayClose: number;
    prevDayHigh: number;
    prevDayLow: number;
    prevDayClose: number;
    // Snapshot (start-of-current-bar).
    prevClosedBarCount: number;
    prevClosedCurrentDayKey: number;
    prevClosedCurrentDayHigh: number;
    prevClosedCurrentDayLow: number;
    prevClosedCurrentDayClose: number;
    prevClosedPrevDayHigh: number;
    prevClosedPrevDayLow: number;
    prevClosedPrevDayClose: number;
};

const NAN = Number.NaN;

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.pivotsStandard called outside an active script step");
    }
    return ctx;
}

function makeNaNLevels(): SevenLevels {
    return { pp: NAN, r1: NAN, s1: NAN, r2: NAN, s2: NAN, r3: NAN, s3: NAN };
}

function classic(h: number, l: number, c: number): SevenLevels {
    const p = (h + l + c) / 3;
    const range = h - l;
    return {
        pp: p,
        r1: 2 * p - l,
        s1: 2 * p - h,
        r2: p + range,
        s2: p - range,
        r3: p + 2 * range,
        s3: p - 2 * range,
    };
}

function fibonacci(h: number, l: number, c: number): SevenLevels {
    const p = (h + l + c) / 3;
    const range = h - l;
    return {
        pp: p,
        r1: p + 0.382 * range,
        s1: p - 0.382 * range,
        r2: p + 0.618 * range,
        s2: p - 0.618 * range,
        r3: p + range,
        s3: p - range,
    };
}

/**
 * Camarilla — R3 / S3 use the (1.1/4) coefficient per the published
 * TradingView formula. R4 / R5 / S4 / S5 defer per the Phase-2
 * README footnote.
 */
function camarilla(h: number, l: number, c: number): SevenLevels {
    const p = (h + l + c) / 3;
    const range = h - l;
    return {
        pp: p,
        r1: c + (1.1 * range) / 12,
        s1: c - (1.1 * range) / 12,
        r2: c + (1.1 * range) / 6,
        s2: c - (1.1 * range) / 6,
        r3: c + (1.1 * range) / 4,
        s3: c - (1.1 * range) / 4,
    };
}

/**
 * Woodie — pivot point weights the close more heavily ((h+l+2c)/4).
 * R3 / S3 anchor on the daily high / low directly (mirrors invinite's
 * `h + 2(p-l)` / `l - 2(h-p)`).
 */
function woodie(h: number, l: number, c: number): SevenLevels {
    const p = (h + l + 2 * c) / 4;
    const range = h - l;
    return {
        pp: p,
        r1: 2 * p - l,
        s1: 2 * p - h,
        r2: p + range,
        s2: p - range,
        r3: h + 2 * (p - l),
        s3: l - 2 * (h - p),
    };
}

const FORMULA_DISPATCH: Readonly<
    Record<PivotsStandardSystem, (h: number, l: number, c: number) => SevenLevels>
> = Object.freeze({
    classic,
    fibonacci,
    camarilla,
    woodie,
});

function computeLevels(slot: PivotsStandardSlot): SevenLevels {
    return computeLevelsFrom(slot.prevDayHigh, slot.prevDayLow, slot.prevDayClose, slot.system);
}

function computeLevelsFrom(
    prevHigh: number,
    prevLow: number,
    prevClose: number,
    system: PivotsStandardSystem,
): SevenLevels {
    if (!Number.isFinite(prevHigh) || !Number.isFinite(prevLow) || !Number.isFinite(prevClose)) {
        return makeNaNLevels();
    }
    return FORMULA_DISPATCH[system](prevHigh, prevLow, prevClose);
}

function initSlot(capacity: number, system: PivotsStandardSystem): PivotsStandardSlot {
    const ppBuffer = new Float64RingBuffer(capacity);
    const r1Buffer = new Float64RingBuffer(capacity);
    const s1Buffer = new Float64RingBuffer(capacity);
    const r2Buffer = new Float64RingBuffer(capacity);
    const s2Buffer = new Float64RingBuffer(capacity);
    const r3Buffer = new Float64RingBuffer(capacity);
    const s3Buffer = new Float64RingBuffer(capacity);
    return {
        outputs: Object.freeze({
            pp: makeSeriesView<number>(ppBuffer),
            r1: makeSeriesView<number>(r1Buffer),
            s1: makeSeriesView<number>(s1Buffer),
            r2: makeSeriesView<number>(r2Buffer),
            s2: makeSeriesView<number>(s2Buffer),
            r3: makeSeriesView<number>(r3Buffer),
            s3: makeSeriesView<number>(s3Buffer),
        }),
        ppBuffer,
        r1Buffer,
        s1Buffer,
        r2Buffer,
        s2Buffer,
        r3Buffer,
        s3Buffer,
        system,
        barCount: 0,
        currentDayKey: 0,
        currentDayHigh: NAN,
        currentDayLow: NAN,
        currentDayClose: NAN,
        prevDayHigh: NAN,
        prevDayLow: NAN,
        prevDayClose: NAN,
        prevClosedBarCount: 0,
        prevClosedCurrentDayKey: 0,
        prevClosedCurrentDayHigh: NAN,
        prevClosedCurrentDayLow: NAN,
        prevClosedCurrentDayClose: NAN,
        prevClosedPrevDayHigh: NAN,
        prevClosedPrevDayLow: NAN,
        prevClosedPrevDayClose: NAN,
    };
}

function snapshot(slot: PivotsStandardSlot): void {
    slot.prevClosedBarCount = slot.barCount;
    slot.prevClosedCurrentDayKey = slot.currentDayKey;
    slot.prevClosedCurrentDayHigh = slot.currentDayHigh;
    slot.prevClosedCurrentDayLow = slot.currentDayLow;
    slot.prevClosedCurrentDayClose = slot.currentDayClose;
    slot.prevClosedPrevDayHigh = slot.prevDayHigh;
    slot.prevClosedPrevDayLow = slot.prevDayLow;
    slot.prevClosedPrevDayClose = slot.prevDayClose;
}

/** NaN-aware max — NaN inputs leave the running aggregate unchanged. */
function safeMax(acc: number, x: number): number {
    if (!Number.isFinite(x)) return acc;
    // Defensive: callers seed `acc` finite before folding, so the
    // `!isFinite(acc)` recovery branch is only reachable if the seed bar
    // contained a NaN high/low — the surrounding pivot pipeline already
    // skips that case.
    /* c8 ignore next */
    if (!Number.isFinite(acc)) return x;
    return x > acc ? x : acc;
}

function safeMin(acc: number, x: number): number {
    if (!Number.isFinite(x)) return acc;
    /* c8 ignore next */
    if (!Number.isFinite(acc)) return x;
    return x < acc ? x : acc;
}

function emitLevels(slot: PivotsStandardSlot, levels: SevenLevels, isTick: boolean): void {
    if (isTick) {
        slot.ppBuffer.replaceHead(levels.pp);
        slot.r1Buffer.replaceHead(levels.r1);
        slot.s1Buffer.replaceHead(levels.s1);
        slot.r2Buffer.replaceHead(levels.r2);
        slot.s2Buffer.replaceHead(levels.s2);
        slot.r3Buffer.replaceHead(levels.r3);
        slot.s3Buffer.replaceHead(levels.s3);
    } else {
        slot.ppBuffer.append(levels.pp);
        slot.r1Buffer.append(levels.r1);
        slot.s1Buffer.append(levels.s1);
        slot.r2Buffer.append(levels.r2);
        slot.s2Buffer.append(levels.s2);
        slot.r3Buffer.append(levels.r3);
        slot.s3Buffer.append(levels.s3);
    }
}

function closeStep(
    slot: PivotsStandardSlot,
    time: number,
    high: number,
    low: number,
    close: number,
): SevenLevels {
    const dayKey = Math.floor(time / MS_PER_DAY);
    snapshot(slot);
    if (slot.barCount === 0) {
        // Seed bar — start the in-progress day aggregate. No prevDay
        // yet → all outputs NaN.
        slot.barCount = 1;
        slot.currentDayKey = dayKey;
        slot.currentDayHigh = high;
        slot.currentDayLow = low;
        slot.currentDayClose = close;
        return makeNaNLevels();
    }
    if (dayKey !== slot.currentDayKey) {
        // Day boundary fired: promote currentDay → prevDay.
        slot.prevDayHigh = slot.currentDayHigh;
        slot.prevDayLow = slot.currentDayLow;
        slot.prevDayClose = slot.currentDayClose;
        slot.currentDayKey = dayKey;
        slot.currentDayHigh = high;
        slot.currentDayLow = low;
        slot.currentDayClose = close;
    } else {
        // Same day — update aggregate.
        slot.currentDayHigh = safeMax(slot.currentDayHigh, high);
        slot.currentDayLow = safeMin(slot.currentDayLow, low);
        if (Number.isFinite(close)) slot.currentDayClose = close;
    }
    slot.barCount += 1;
    return computeLevels(slot);
}

function tickStep(
    slot: PivotsStandardSlot,
    time: number,
    _high: number,
    _low: number,
    _close: number,
): SevenLevels {
    if (slot.prevClosedBarCount === 0) {
        return makeNaNLevels();
    }
    // Tick replay from snapshot. Determine if the tick crosses a day
    // boundary relative to the snapshot's currentDayKey.
    const dayKey = Math.floor(time / MS_PER_DAY);
    const snapKey = slot.prevClosedCurrentDayKey;
    const snapPrevHigh = slot.prevClosedPrevDayHigh;
    const snapPrevLow = slot.prevClosedPrevDayLow;
    const snapPrevClose = slot.prevClosedPrevDayClose;
    if (dayKey !== snapKey) {
        // Boundary crossing on the tick — promote snapshot's current
        // day to prev (transient), levels derive from the snapshot's
        // currentDay.
        return computeLevelsFrom(
            slot.prevClosedCurrentDayHigh,
            slot.prevClosedCurrentDayLow,
            slot.prevClosedCurrentDayClose,
            slot.system,
        );
    }
    // Same day — levels still derive from the snapshot's prevDay.
    return computeLevelsFrom(snapPrevHigh, snapPrevLow, snapPrevClose, slot.system);
}

/**
 * Pivots Standard — classical daily pivot-point levels (P, R1..R3,
 * S1..S3) derived from the previous UTC-day's high / low / close.
 * Four formula systems supported: `"classic"` (default),
 * `"fibonacci"`, `"camarilla"`, `"woodie"`. Reads `bar.time` /
 * `bar.high` / `bar.low` / `bar.close` directly; session boundary
 * detection uses `Math.floor(bar.time / 86_400_000)` (UTC-day key).
 * Returns a cached seven-Series `{ pp, r1, s1, r2, s2, r3, s3 }`
 * record (same identity every bar).
 *
 * The runtime aggregates the in-progress day's HLC on every close;
 * when a new UTC-day opens, the in-progress aggregate is promoted
 * to `prevDay` and the new day's pivot levels are computed via the
 * selected formula. Outputs are NaN at every bar in the FIRST UTC
 * day (no `prevDay` available) and finite from the SECOND UTC day
 * onward.
 *
 * **Deferred:** R4 / R5 / S4 / S5 levels (Camarilla's full table
 * defines them; Phase 2 ships R1..R3 / S1..S3 only). DeMark /
 * Traditional formula systems also defer.
 *
 * NaN bar leaves the day aggregate unchanged (NaN-aware max / min).
 * Tick-mode replays from the snapshot captured at the start of the
 * current bar.
 *
 * @formula  pp / r1..r3 / s1..s3 derived from prevDay HLC per system :
 *           classic   — pp = (h+l+c)/3 ; r1 = 2p − l ; s1 = 2p − h ; r2 = p + (h−l) ; s2 = p − (h−l) ; r3 = p + 2(h−l) ; s3 = p − 2(h−l) ;
 *           fibonacci — pp = (h+l+c)/3 ; r1/s1 = p ± 0.382·(h−l) ; r2/s2 = p ± 0.618·(h−l) ; r3/s3 = p ± (h−l) ;
 *           camarilla — pp = (h+l+c)/3 ; r1/s1 = c ± 1.1·(h−l)/12 ; r2/s2 = c ± 1.1·(h−l)/6 ; r3/s3 = c ± 1.1·(h−l)/4 ;
 *           woodie    — pp = (h+l+2c)/4 ; r1 = 2p − l ; s1 = 2p − h ; r2 = p + (h−l) ; s2 = p − (h−l) ; r3 = h + 2(p−l) ; s3 = l − 2(h−p)
 * @warmup   1 UTC-day boundary (every output NaN until the second
 *           UTC day opens)
 * @anchors  system
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const p = ta.pivotsStandard();
 *     // plot(p.pp);
 *     // plot(p.r1);
 *     // plot(p.s1);
 */
export function pivotsStandard(slotId: string, opts?: PivotsStandardOpts): PivotsStandardResult {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as PivotsStandardSlot | undefined;
    if (slot === undefined) {
        const system = opts?.system ?? DEFAULT_SYSTEM;
        slot = initSlot(ctx.stream.ohlcv.close.capacity, system);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const bar = ctx.stream.bar;
    if (ctx.isTick) {
        const levels = tickStep(slot, bar.time, bar.high, bar.low, bar.close);
        emitLevels(slot, levels, true);
    } else {
        const levels = closeStep(slot, bar.time, bar.high, bar.low, bar.close);
        emitLevels(slot, levels, false);
    }
    return slot.outputs;
}
