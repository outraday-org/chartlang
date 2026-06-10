// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// Ported from ../invinite/src/components/trading-chart/indicators/lib/volume-profile/volume-profile-shared.ts
//   @ 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4.
// Translated, not transcribed — ReadonlyArray<number> inputs, JSDoc, runtime.
// See packages/runtime/src/ta/CLAUDE.md for the port convention.

import { buildBucketEdges } from "./bucketEdges";
import { bucketizeVolumeDetailed } from "./bucketizeVolume";
import { computeDevelopingSeries, derivePriceRange } from "./developingSeries";
import { assessVolumeProfileCost } from "./tooHeavy";
import type { VolumeProfileBar, VolumeProfileConfig, VolumeProfileResult } from "./types";
import { DEFAULT_TICK_SIZE } from "./types";
import { computeValueArea } from "./valueArea";

/**
 * Compute the pure shared volume-profile payload used by all four
 * Phase 5 profile primitives.
 *
 * @formula PLAN §9.2 / §10.1.1 — slice the lane/finer window, bucket
 *          volume by price, compute POC/value-area, optionally compute
 *          developing POC/VA series in lane-bar space.
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // const profile = computeProfile({ laneBars: bars, finerBars: [], windowFromIdx: 0, windowToIdx: bars.length - 1, config: { rowSize: 20, valueAreaPct: 70 } });
 */
export function computeProfile(args: {
    laneBars: ReadonlyArray<VolumeProfileBar>;
    finerBars?: ReadonlyArray<VolumeProfileBar>;
    windowFromIdx: number;
    windowToIdx: number;
    config: VolumeProfileConfig;
    computeDeveloping?: boolean;
}): VolumeProfileResult {
    const { laneBars, config } = args;
    const finerBars = args.finerBars ?? [];
    if (laneBars.length === 0) return emptyProfile(false, null, null);

    const fromIdx = Math.max(0, Math.min(laneBars.length - 1, args.windowFromIdx));
    const toIdx = Math.max(fromIdx, Math.min(laneBars.length - 1, args.windowToIdx));
    const laneSlice = laneBars.slice(fromIdx, toIdx + 1);

    const finerSlice = sliceBarsByTime(
        finerBars,
        laneSlice[0].time,
        laneSlice[laneSlice.length - 1].time,
    );
    const bucketSource = finerSlice.length > 0 ? finerSlice : laneSlice;
    const range = derivePriceRange(bucketSource);
    const costStatus = assessVolumeProfileCost({
        finerCandleCount: finerSlice.length,
        priceMax: range.priceMax,
        priceMin: range.priceMin,
        rowSize: config.rowSize,
        rowsLayout: config.rowsLayout ?? "numberOfRows",
        tickSize: config.tickSize ?? DEFAULT_TICK_SIZE,
    });
    if (costStatus.heavy)
        return emptyProfile(costStatus.heavy, costStatus.reason, costStatus.recommendedRowSize);
    if (range.priceMax <= range.priceMin) return emptyProfile(false, null, null);

    const edges = buildBucketEdges(
        range.priceMin,
        range.priceMax,
        config.rowsLayout ?? "numberOfRows",
        config.rowSize,
        config.tickSize ?? DEFAULT_TICK_SIZE,
    );
    const bucketized = bucketizeVolumeDetailed(bucketSource, edges, config.volumeSplit ?? "upDown");
    if (bucketized.totalVolume <= 0) return emptyProfile(false, null, null);

    const valueArea = computeValueArea(bucketized.rows, config.valueAreaPct, bucketized.pocIdx);
    const valueAreaMask = new Float64Array(bucketized.rows.length);
    const lo = Math.min(valueArea.vahIdx, valueArea.valIdx);
    const hi = Math.max(valueArea.vahIdx, valueArea.valIdx);
    for (let i = 0; i < valueAreaMask.length; i += 1) valueAreaMask[i] = i >= lo && i <= hi ? 1 : 0;

    const base = {
        buckets: bucketized.buckets,
        costStatus,
        poc: valueArea.poc,
        rows: bucketized.rows,
        valHigh: valueArea.valHigh,
        valLow: valueArea.valLow,
        valueAreaMask,
    };

    if (args.computeDeveloping === true) {
        return {
            ...base,
            developing: computeDevelopingSeries({
                config,
                finerBars,
                laneBars,
                windowFromIdx: fromIdx,
                windowToIdx: toIdx,
            }),
        };
    }

    return base;
}

function emptyProfile(
    heavy: boolean,
    reason: VolumeProfileResult["costStatus"]["reason"],
    recommendedRowSize: number | null,
): VolumeProfileResult {
    return {
        buckets: [],
        costStatus: { heavy, reason, recommendedRowSize },
        poc: Number.NaN,
        rows: [],
        valHigh: Number.NaN,
        valLow: Number.NaN,
        valueAreaMask: new Float64Array(0),
    };
}

/**
 * Slice sorted bars to the inclusive `[timeFromMs, timeToMs]` window.
 *
 * @formula PLAN §10.1.1 — finer lower-timeframe bars are clipped to
 *          the same wall-clock window as the lane profile.
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // const slice = sliceBarsByTime(bars, 0, 60_000);
 */
export function sliceBarsByTime(
    bars: ReadonlyArray<VolumeProfileBar>,
    timeFromMs: number,
    timeToMs: number,
): ReadonlyArray<VolumeProfileBar> {
    if (bars.length === 0) return bars;
    const start = lowerBoundTime(bars, timeFromMs);
    const end = upperBoundTime(bars, timeToMs);
    if (start >= end) return [];
    return bars.slice(start, end);
}

function lowerBoundTime(bars: ReadonlyArray<VolumeProfileBar>, target: number): number {
    let lo = 0;
    let hi = bars.length;
    while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (bars[mid].time < target) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}

function upperBoundTime(bars: ReadonlyArray<VolumeProfileBar>, target: number): number {
    let lo = 0;
    let hi = bars.length;
    while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (bars[mid].time <= target) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}
