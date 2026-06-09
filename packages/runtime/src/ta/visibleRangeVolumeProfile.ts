// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// Ported from ../invinite/src/components/trading-chart/indicators/visible-range-volume-profile.ts
//   @ 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4.
// Translated, not transcribed — Series<T> shape, opts.offset, JSDoc.
// See packages/runtime/src/ta/CLAUDE.md for the port convention.

import type {
    VisibleRangeVolumeProfileOpts,
    VisibleRangeVolumeProfileResult,
} from "@invinite-org/chartlang-core";

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

type VisibleRangeVolumeProfileSlot = VolumeProfileCore & {
    readonly result: VisibleRangeVolumeProfileResult;
    readonly shiftedResults: Map<number, VisibleRangeVolumeProfileResult>;
};

type MutableVisibleRangeVolumeProfileSlot = Omit<VisibleRangeVolumeProfileSlot, "result"> & {
    result: VisibleRangeVolumeProfileResult;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.visibleRangeVolumeProfile called outside an active script step");
    }
    return ctx;
}

function initSlot(capacity: number): VisibleRangeVolumeProfileSlot {
    const core = createVolumeProfileCore(capacity);
    const slot: MutableVisibleRangeVolumeProfileSlot = {
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
    slot: VisibleRangeVolumeProfileSlot,
    offset: number,
): VisibleRangeVolumeProfileResult {
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

function collectBars(ctx: RuntimeContext): ReadonlyArray<VolumeProfileBar> {
    const { ohlcv } = ctx.stream;
    const { fromTime, toTime } = ctx.stream.bar.viewport;
    const bars: VolumeProfileBar[] = [];
    for (let lookback = ohlcv.close.length - 1; lookback >= 0; lookback -= 1) {
        const time = ohlcv.time.at(lookback);
        if (time < fromTime || time > toTime) continue;
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
 * Visible-Range Volume Profile — buckets the current visible range's
 * volume by price, emits a `horizontal-histogram`, and returns cached
 * POC / VAH / VAL series.
 *
 * The Phase 5 OSS runtime supplies the visible range through
 * `bar.viewport`, populated as the latest 100 bars ending at the
 * current head. Real chart viewport injection is deferred to adapter
 * integrations in Phase 6.
 *
 * @formula  Port of invinite visible-range-vp: slice visible candles,
 *           bucket volume by price, then derive POC / value-area high /
 *           value-area low via the shared volume-profile pipeline.
 * @anchors  Visible range = `(bar.viewport.fromTime, bar.viewport.toTime)`.
 * @warmup   First 2 bars for non-degenerate bucketization; constant-price
 *           positive-volume input emits a one-bucket fallback.
 * @since 0.5
 * @experimental
 * @example
 *     // import { ta, plot } from "@invinite-org/chartlang-core";
 *     // const vp = ta.visibleRangeVolumeProfile({ rowSize: 24 });
 *     // plot(vp.poc, { title: "VRVP POC" });
 */
export function visibleRangeVolumeProfile(
    slotId: string,
    opts?: VisibleRangeVolumeProfileOpts,
): VisibleRangeVolumeProfileResult {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as VisibleRangeVolumeProfileSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }

    const snapshot = resolveVolumeProfileSnapshot({
        bars: collectBars(ctx),
        bucketColor: opts?.bucketColor,
        config: volumeProfileConfigFromOpts(opts ?? {}),
    });
    commitVolumeProfileSnapshot(slot, ctx.isTick, snapshot);
    emitVolumeProfileHistogram(
        ctx,
        slotId,
        "Visible Range Volume Profile",
        snapshot.poc,
        snapshot.buckets,
    );
    return resultForOffset(slot, opts?.offset ?? 0);
}
