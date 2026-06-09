// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// Ported from ../invinite/src/components/trading-chart/indicators/session-volume-profile.ts
//   @ 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4.
// Translated, not transcribed — Series<T> shape, opts.offset, JSDoc.
// See packages/runtime/src/ta/CLAUDE.md for the port convention.

import type {
    SessionVolumeProfileOpts,
    SessionVolumeProfileResult,
} from "@invinite-org/chartlang-core";

import { pushDiagnostic } from "../emit";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView, makeShiftedSeriesView } from "../seriesView";
import {
    type VolumeProfileBar,
    type VolumeProfileCore,
    commitVolumeProfileSnapshot,
    createVolumeProfileCore,
    emitVolumeProfileHistogram,
    resolveVolumeProfileSnapshot,
    volumeProfileConfigFromOpts,
} from "./lib/volume-profile";

const DAY_MS = 86_400_000;

type SessionVolumeProfileSlot = VolumeProfileCore & {
    readonly result: SessionVolumeProfileResult;
    readonly shiftedResults: Map<number, SessionVolumeProfileResult>;
};

type MutableSessionVolumeProfileSlot = Omit<SessionVolumeProfileSlot, "result"> & {
    result: SessionVolumeProfileResult;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.sessionVolumeProfile called outside an active script step");
    }
    return ctx;
}

function initSlot(capacity: number): SessionVolumeProfileSlot {
    const core = createVolumeProfileCore(capacity);
    const slot: MutableSessionVolumeProfileSlot = {
        ...core,
        result: Object.freeze({
            get buckets() {
                return slot.buckets;
            },
            poc: makeSeriesView<number>(core.pocBuffer),
            valHigh: makeSeriesView<number>(core.valHighBuffer),
            valLow: makeSeriesView<number>(core.valLowBuffer),
        }),
        shiftedResults: new Map(),
    };
    return slot;
}

function resultForOffset(
    slot: SessionVolumeProfileSlot,
    offset: number,
): SessionVolumeProfileResult {
    if (offset === 0) return slot.result;
    let cached = slot.shiftedResults.get(offset);
    if (cached === undefined) {
        cached = Object.freeze({
            get buckets() {
                return slot.buckets;
            },
            poc: makeShiftedSeriesView<number>(slot.pocBuffer, offset),
            valHigh: makeShiftedSeriesView<number>(slot.valHighBuffer, offset),
            valLow: makeShiftedSeriesView<number>(slot.valLowBuffer, offset),
        });
        slot.shiftedResults.set(offset, cached);
    }
    return cached;
}

function utcDayStart(time: number): number {
    return Math.floor(time / DAY_MS) * DAY_MS;
}

function parseSessionWindowMinutes(
    session: string,
): { startMinutes: number; endMinutes: number } | null {
    const match = /^(\d{1,2})(?::?(\d{2}))?\s*-\s*(\d{1,2})(?::?(\d{2}))?$/.exec(session.trim());
    if (match === null) return null;
    const startHour = Number(match[1]);
    const startMinute = match[2] === undefined ? 0 : Number(match[2]);
    const endHour = Number(match[3]);
    const endMinute = match[4] === undefined ? 0 : Number(match[4]);
    if (startHour < 0 || startHour > 23 || startMinute < 0 || startMinute > 59) return null;
    if (endHour < 0 || endHour > 23 || endMinute < 0 || endMinute > 59) return null;
    return {
        startMinutes: startHour * 60 + startMinute,
        endMinutes: endHour * 60 + endMinute,
    };
}

function sessionBoundaryFromDescriptor(time: number, session: string): number | null {
    const parsed = parseSessionWindowMinutes(session);
    if (parsed === null) return null;
    const dayStart = utcDayStart(time);
    const boundary = dayStart + parsed.startMinutes * 60_000;
    return time >= boundary ? boundary : boundary - DAY_MS;
}

function diagnoseMissingSession(ctx: RuntimeContext, slotId: string): void {
    const key = `session-info-missing|${slotId}`;
    if (ctx.diagnosedRequestKeys.has(key)) return;
    ctx.diagnosedRequestKeys.add(key);
    pushDiagnostic(ctx.emissions, {
        kind: "diagnostic",
        severity: "warning",
        code: "session-info-missing",
        message:
            "Adapter did not provide syminfo.session; ta.sessionVolumeProfile used UTC-day boundaries.",
        slotId,
        bar: ctx.barIndex(),
    });
}

function resolveSessionStart(
    ctx: RuntimeContext,
    slotId: string,
    opts: SessionVolumeProfileOpts | undefined,
): number {
    if (opts?.sessionStart !== undefined) return opts.sessionStart;
    const session = ctx.views.syminfo.session;
    if (!ctx.capabilities.symInfoFields.has("session") || session === "") {
        diagnoseMissingSession(ctx, slotId);
        return utcDayStart(ctx.stream.bar.time);
    }
    const boundary = sessionBoundaryFromDescriptor(ctx.stream.bar.time, session);
    if (boundary === null) {
        diagnoseMissingSession(ctx, slotId);
        return utcDayStart(ctx.stream.bar.time);
    }
    return boundary;
}

function collectBars(ctx: RuntimeContext, sessionStart: number): ReadonlyArray<VolumeProfileBar> {
    const { ohlcv } = ctx.stream;
    const bars: VolumeProfileBar[] = [];
    for (let lookback = ohlcv.close.length - 1; lookback >= 0; lookback -= 1) {
        const time = ohlcv.time.at(lookback);
        if (time <= sessionStart) continue;
        bars.push({
            close: ohlcv.close.at(lookback),
            high: ohlcv.high.at(lookback),
            low: ohlcv.low.at(lookback),
            open: ohlcv.open.at(lookback),
            time,
            volume: ohlcv.volume.at(lookback),
        });
    }
    return bars;
}

/**
 * Session Volume Profile — bucketizes the current session's volume
 * by price, resetting when `bar.time` crosses the active session
 * boundary.
 *
 * @formula  Port of invinite session-vp: find the current session
 *           window, bucket volume by price, then derive POC / value-
 *           area high / value-area low via the shared volume-profile
 *           pipeline.
 * @anchors  `syminfo.session` descriptor, or `opts.sessionStart`
 *           override when provided.
 * @warmup   NaN until a session window has positive volume; missing
 *           `syminfo.session` falls back to UTC-day boundaries.
 * @since 0.5
 * @experimental
 * @example
 *     // import { plot, ta } from "@invinite-org/chartlang-core";
 *     // const vp = ta.sessionVolumeProfile({ rowSize: 24 });
 *     // plot(vp.poc, { style: { kind: "horizontal-histogram", buckets: vp.buckets } });
 */
export function sessionVolumeProfile(
    slotId: string,
    opts?: SessionVolumeProfileOpts,
): SessionVolumeProfileResult {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as SessionVolumeProfileSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }

    const sessionStart = resolveSessionStart(ctx, slotId, opts);
    const bars = ctx.stream.bar.time <= sessionStart ? [] : collectBars(ctx, sessionStart);
    const snapshot = resolveVolumeProfileSnapshot({
        bars,
        bucketColor: opts?.bucketColor,
        config: volumeProfileConfigFromOpts(opts ?? {}),
    });
    commitVolumeProfileSnapshot(slot, ctx.isTick, snapshot);
    emitVolumeProfileHistogram(
        ctx,
        slotId,
        "Session Volume Profile",
        snapshot.poc,
        snapshot.buckets,
    );
    return resultForOffset(slot, opts?.offset ?? 0);
}
