// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// Ported from ../invinite/src/components/trading-chart/indicators/fixed-range-volume-profile.ts
//   @ 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4.
// Translated, not transcribed — Series<T> shape, opts.offset, JSDoc.
// See packages/runtime/src/ta/CLAUDE.md for the port convention.

import type {
    FixedRangeVolumeProfileOpts,
    FixedRangeVolumeProfileResult,
} from "@invinite-org/chartlang-core";

import { pushDiagnostic } from "../emit";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView, makeShiftedSeriesView } from "../seriesView";
import {
    type VolumeProfileBar,
    type VolumeProfileCore,
    type VolumeProfileSnapshot,
    commitVolumeProfileSnapshot,
    createVolumeProfileCore,
    emitVolumeProfileHistogram,
    emptyVolumeProfileSnapshot,
    resolveVolumeProfileSnapshot,
    volumeProfileConfigFromOpts,
} from "./lib/volume-profile";

type FixedRangeVolumeProfileSlot = VolumeProfileCore & {
    frozen: VolumeProfileSnapshot | null;
    readonly result: FixedRangeVolumeProfileResult;
    readonly shiftedResults: Map<number, FixedRangeVolumeProfileResult>;
};

type MutableFixedRangeVolumeProfileSlot = Omit<FixedRangeVolumeProfileSlot, "result"> & {
    result: FixedRangeVolumeProfileResult;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.fixedRangeVolumeProfile called outside an active script step");
    }
    return ctx;
}

function initSlot(capacity: number): FixedRangeVolumeProfileSlot {
    const core = createVolumeProfileCore(capacity);
    const slot: MutableFixedRangeVolumeProfileSlot = {
        ...core,
        frozen: null,
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
    slot: FixedRangeVolumeProfileSlot,
    offset: number,
): FixedRangeVolumeProfileResult {
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

function collectBars(
    ctx: RuntimeContext,
    from: number,
    to: number,
): ReadonlyArray<VolumeProfileBar> {
    const { ohlcv } = ctx.stream;
    const bars: VolumeProfileBar[] = [];
    for (let lookback = ohlcv.close.length - 1; lookback >= 0; lookback -= 1) {
        const time = ohlcv.time.at(lookback);
        if (time < from || time > to) continue;
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

function diagnoseInvertedRange(ctx: RuntimeContext, slotId: string): void {
    const key = `fixed-range-inverted|${slotId}`;
    if (ctx.diagnosedRequestKeys.has(key)) return;
    ctx.diagnosedRequestKeys.add(key);
    pushDiagnostic(ctx.emissions, {
        kind: "diagnostic",
        severity: "warning",
        code: "fixed-range-inverted",
        message: "ta.fixedRangeVolumeProfile requires opts.from <= opts.to.",
        slotId,
        bar: ctx.barIndex(),
    });
}

/**
 * Fixed-Range Volume Profile — bucketizes volume between two
 * user-picked time anchors, inclusive on both ends.
 *
 * Bars before `opts.from` emit NaN. Bars after `opts.to` reuse the
 * frozen profile captured at the `to` bar. If `opts.from > opts.to`,
 * the primitive emits one `fixed-range-inverted` diagnostic per slot
 * and returns NaN series values.
 *
 * @formula  Port of invinite fixed-range-vp: collect candles in the
 *           fixed `[from, to]` window, bucket volume by price, then
 *           derive POC / value-area high / value-area low through the
 *           shared volume-profile pipeline.
 * @anchors  `opts.from: Time` and `opts.to: Time`, typically supplied
 *           by two `input.time(..., { pickFromChart: true })` inputs.
 * @warmup   NaN before `opts.from`; a degenerate `from === to`
 *           one-bar window can emit on the anchor bar when it has
 *           finite positive volume.
 * @since 0.5
 * @experimental
 * @example
 *     // import { input, plot, ta } from "@invinite-org/chartlang-core";
 *     // const from = input.time(0, { pickFromChart: true, title: "From" });
 *     // const to = input.time(0, { pickFromChart: true, title: "To" });
 *     // const vp = ta.fixedRangeVolumeProfile({ from: from.value, to: to.value });
 *     // plot(vp.poc, { style: { kind: "horizontal-histogram", buckets: vp.buckets } });
 */
export function fixedRangeVolumeProfile(
    slotId: string,
    opts: FixedRangeVolumeProfileOpts,
): FixedRangeVolumeProfileResult {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as FixedRangeVolumeProfileSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }

    let snapshot: VolumeProfileSnapshot = emptyVolumeProfileSnapshot();
    if (opts.from > opts.to) {
        diagnoseInvertedRange(ctx, slotId);
        slot.frozen = null;
    } else if (ctx.stream.bar.time < opts.from) {
        slot.frozen = null;
    } else if (ctx.stream.bar.time > opts.to && slot.frozen !== null) {
        snapshot = slot.frozen;
    } else {
        snapshot = resolveVolumeProfileSnapshot({
            bars: collectBars(ctx, opts.from, opts.to),
            bucketColor: opts.bucketColor,
            config: volumeProfileConfigFromOpts(opts),
        });
        if (ctx.stream.bar.time >= opts.to) slot.frozen = snapshot;
    }

    commitVolumeProfileSnapshot(slot, ctx.isTick, snapshot);
    emitVolumeProfileHistogram(
        ctx,
        slotId,
        "Fixed Range Volume Profile",
        snapshot.poc,
        snapshot.buckets,
    );
    return resultForOffset(slot, opts.offset ?? 0);
}
