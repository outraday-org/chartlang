// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// Ported from ../invinite/src/components/trading-chart/indicators/anchored-volume-profile.ts
//   @ 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4.
// Translated, not transcribed — Series<T> shape, input.time anchor, opts.offset, JSDoc.
// See packages/runtime/src/ta/CLAUDE.md for the port convention.

import type {
    AnchoredVolumeProfileOpts,
    AnchoredVolumeProfileResult,
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

type AnchoredVolumeProfileSlot = VolumeProfileCore & {
    readonly result: AnchoredVolumeProfileResult;
    readonly shiftedResults: Map<number, AnchoredVolumeProfileResult>;
};

type MutableAnchoredVolumeProfileSlot = Omit<AnchoredVolumeProfileSlot, "result"> & {
    result: AnchoredVolumeProfileResult;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.anchoredVolumeProfile called outside an active script step");
    }
    return ctx;
}

function initSlot(capacity: number): AnchoredVolumeProfileSlot {
    const core = createVolumeProfileCore(capacity);
    const slot: MutableAnchoredVolumeProfileSlot = {
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
    slot: AnchoredVolumeProfileSlot,
    offset: number,
): AnchoredVolumeProfileResult {
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

function collectBars(ctx: RuntimeContext, anchor: number): ReadonlyArray<VolumeProfileBar> {
    if (ctx.stream.bar.time <= anchor) return [];

    const { ohlcv } = ctx.stream;
    const bars: VolumeProfileBar[] = [];
    for (let lookback = ohlcv.close.length - 1; lookback >= 0; lookback -= 1) {
        const time = ohlcv.time.at(lookback);
        if (time < anchor) continue;
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
 * Anchored Volume Profile — reads a user-picked time anchor and
 * bucketizes volume from that anchor forward.
 *
 * @formula  Port of invinite anchored-volume-profile: find the first
 *           candle with `time >= anchor`, bucket anchor→right-edge
 *           volume by price, then derive POC / value-area high /
 *           value-area low through the shared volume-profile pipeline.
 * @anchors  `opts.anchor: Time` — supplied by `input.time(..., { pickFromChart: true })`.
 * @warmup   NaN through the bar at `anchor`; first bar after `anchor`
 *           can emit once the anchor→current window has positive volume.
 * @since 0.5
 * @stable
 * @example
 *     // import { input, plot, ta } from "@invinite-org/chartlang-core";
 *     // const anchor = input.time(0, { pickFromChart: true });
 *     // const vp = ta.anchoredVolumeProfile({ anchor: anchor.value, rowSize: 24 });
 *     // plot(vp.poc, { style: { kind: "horizontal-histogram", buckets: vp.buckets } });
 */
export function anchoredVolumeProfile(
    slotId: string,
    opts: AnchoredVolumeProfileOpts,
): AnchoredVolumeProfileResult {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as AnchoredVolumeProfileSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }

    const snapshot = resolveVolumeProfileSnapshot({
        bars: collectBars(ctx, opts.anchor),
        bucketColor: opts.bucketColor,
        config: volumeProfileConfigFromOpts(opts),
    });
    commitVolumeProfileSnapshot(slot, ctx.isTick, snapshot);
    emitVolumeProfileHistogram(
        ctx,
        slotId,
        "Anchored Volume Profile",
        snapshot.poc,
        snapshot.buckets,
    );
    return resultForOffset(slot, opts.offset ?? 0);
}
