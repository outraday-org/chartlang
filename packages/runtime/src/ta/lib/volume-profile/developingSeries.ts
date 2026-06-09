// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// Ported from ../invinite/src/components/trading-chart/indicators/lib/volume-profile/developing-series.ts
//   @ 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4.
// Translated, not transcribed — ReadonlyArray<number> inputs, JSDoc, runtime.
// See packages/runtime/src/ta/CLAUDE.md for the port convention.

import { buildBucketEdges } from "./bucketEdges";
import { bucketizeVolumeDetailed } from "./bucketizeVolume";
import type { DevelopingProfileSeries, VolumeProfileBar, VolumeProfileConfig } from "./types";
import { DEFAULT_TICK_SIZE } from "./types";
import { computeValueArea } from "./valueArea";

const WARMUP_BARS = 30;

/**
 * Compute lane-indexed developing POC / VAH / VAL series.
 *
 * @formula PLAN §9.2 / §10.1.1 — for each lane bar, bucket all source
 *          bars in the active profile window up to that bar's time.
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // const developing = computeDevelopingSeries({ laneBars: bars, finerBars: [], windowFromIdx: 0, windowToIdx: bars.length - 1, config: { rowSize: 20, valueAreaPct: 70 } });
 */
export function computeDevelopingSeries(args: {
    laneBars: ReadonlyArray<VolumeProfileBar>;
    finerBars: ReadonlyArray<VolumeProfileBar>;
    windowFromIdx: number;
    windowToIdx: number;
    config: VolumeProfileConfig;
}): DevelopingProfileSeries {
    const { laneBars, finerBars, windowFromIdx, windowToIdx, config } = args;
    const laneCount = laneBars.length;
    const developingPoc = new Float64Array(laneCount);
    const developingVahHigh = new Float64Array(laneCount);
    const developingVahLow = new Float64Array(laneCount);
    developingPoc.fill(Number.NaN);
    developingVahHigh.fill(Number.NaN);
    developingVahLow.fill(Number.NaN);
    if (laneCount === 0) return { developingPoc, developingVahHigh, developingVahLow };

    const fromIdx = Math.max(0, Math.min(laneCount - 1, windowFromIdx));
    const toIdx = Math.max(fromIdx, Math.min(laneCount - 1, windowToIdx));
    const source = finerBars.length > 0 ? finerBars : laneBars;
    const sourceStart = lowerBoundTime(source, laneBars[fromIdx].time);
    let sourceEnd = sourceStart;

    for (let i = fromIdx; i <= toIdx; i += 1) {
        while (sourceEnd < source.length && source[sourceEnd].time <= laneBars[i].time) sourceEnd += 1;
        const slice = source.slice(sourceStart, sourceEnd);
        if (slice.length <= WARMUP_BARS) continue;

        const { priceMax, priceMin } = derivePriceRange(slice);
        const edges = buildBucketEdges(
            priceMin,
            priceMax,
            config.rowsLayout ?? "numberOfRows",
            config.rowSize,
            config.tickSize ?? DEFAULT_TICK_SIZE,
        );
        const bucketized = bucketizeVolumeDetailed(slice, edges, config.volumeSplit ?? "upDown");
        if (bucketized.totalVolume <= 0) continue;

        const valueArea = computeValueArea(bucketized.rows, config.valueAreaPct, bucketized.pocIdx);
        developingPoc[i] = valueArea.poc;
        developingVahHigh[i] = valueArea.valHigh;
        developingVahLow[i] = valueArea.valLow;
    }

    return { developingPoc, developingVahHigh, developingVahLow };
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

/**
 * Derive min/max price bounds for a bar slice.
 *
 * @formula PLAN §9.2 — bucket range spans the min low to max high
 *          of the selected profile source.
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // const range = derivePriceRange(bars);
 */
export function derivePriceRange(bars: ReadonlyArray<Pick<VolumeProfileBar, "high" | "low">>): {
    priceMin: number;
    priceMax: number;
} {
    let priceMin = Number.POSITIVE_INFINITY;
    let priceMax = Number.NEGATIVE_INFINITY;
    for (const bar of bars) {
        // Skip bars with non-finite OHLC. Per the Bar contract NaN is allowed
        // and would otherwise poison the running min/max (NaN comparisons
        // return false), letting NaN edges flow into bucketization.
        if (!Number.isFinite(bar.low) || !Number.isFinite(bar.high)) continue;
        if (bar.low < priceMin) priceMin = bar.low;
        if (bar.high > priceMax) priceMax = bar.high;
    }
    if (priceMin === Number.POSITIVE_INFINITY) return { priceMax: 0, priceMin: 0 };
    return { priceMax, priceMin };
}
