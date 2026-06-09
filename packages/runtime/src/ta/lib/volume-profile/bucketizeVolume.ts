// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// Ported from ../invinite/src/components/trading-chart/indicators/lib/volume-profile/bucketize-volume.ts
//   @ 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4.
// Translated, not transcribed — ReadonlyArray<number> inputs, JSDoc, runtime.
// See packages/runtime/src/ta/CLAUDE.md for the port convention.

import type { BucketizedVolume, VolumeProfileBar, VolumeProfileBucket, VolumeProfileRow, VolumeSplit } from "./types";

/**
 * Distribute each bar's volume across overlapping price buckets and
 * return the Phase 5 `horizontal-histogram` bucket shape.
 *
 * @formula PLAN §9.2 — share = volume * overlap([bar.low, bar.high], bucket) / max(high - low, eps).
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // const buckets = bucketizeVolume(bars, new Float64Array([100, 101]), "total");
 */
export function bucketizeVolume(
    bars: ReadonlyArray<VolumeProfileBar>,
    bucketEdges: ArrayLike<number>,
    volumeSplit: VolumeSplit,
): ReadonlyArray<VolumeProfileBucket> {
    return bucketizeVolumeDetailed(bars, bucketEdges, volumeSplit).buckets;
}

/**
 * Detailed bucketization retaining row bounds, directional volume,
 * total volume, and POC index for value-area/profile computation.
 *
 * @formula PLAN §9.2 — same overlap weighting as {@link bucketizeVolume}.
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // const detailed = bucketizeVolumeDetailed(bars, edges, "upDown");
 */
export function bucketizeVolumeDetailed(
    bars: ReadonlyArray<VolumeProfileBar>,
    bucketEdges: ArrayLike<number>,
    volumeSplit: VolumeSplit,
): BucketizedVolume {
    const bucketCount = bucketEdges.length - 1;
    if (bucketCount <= 0) return { buckets: [], pocIdx: -1, rows: [], totalVolume: 0 };

    const upPerBucket = new Float64Array(bucketCount);
    const downPerBucket = new Float64Array(bucketCount);

    for (const bar of bars) {
        const vol = Number.isFinite(bar.volume) ? bar.volume : 0;
        if (vol <= 0) continue;

        const low = bar.low;
        const high = bar.high;
        // Skip bars whose price fields aren't finite or whose range is
        // inverted / zero. NaN inputs would otherwise propagate `share = NaN`
        // into every overlapping bucket and silently corrupt the profile.
        if (!Number.isFinite(low) || !Number.isFinite(high)) continue;
        if (!Number.isFinite(bar.open) || !Number.isFinite(bar.close)) continue;
        if (high <= low) continue;

        const span = high - low;
        const isUp = bar.close >= bar.open;

        for (let b = 0; b < bucketCount; b += 1) {
            const edgeLow = bucketEdges[b];
            const edgeHigh = bucketEdges[b + 1];
            if (edgeHigh <= low) continue;
            if (edgeLow >= high) break;

            const overlap = Math.min(edgeHigh, high) - Math.max(edgeLow, low);
            if (overlap <= 0) continue;

            const share = (vol * overlap) / span;
            if (isUp) upPerBucket[b] += share;
            else downPerBucket[b] += share;
        }
    }

    const rows = new Array<VolumeProfileRow>(bucketCount);
    const buckets = new Array<VolumeProfileBucket>(bucketCount);
    let totalVolume = 0;
    let pocIdx = -1;
    let pocVolume = -1;

    for (let b = 0; b < bucketCount; b += 1) {
        const rawUp = upPerBucket[b];
        const rawDown = downPerBucket[b];
        const split = splitVolume(rawUp, rawDown, volumeSplit);
        const low = bucketEdges[b];
        const high = bucketEdges[b + 1];
        const mid = (low + high) / 2;

        rows[b] = {
            downVolume: split.downVolume,
            high,
            low,
            mid,
            upVolume: split.upVolume,
            volume: split.volume,
        };
        buckets[b] = { price: mid, volume: split.volume };
        totalVolume += split.volume;
        if (split.volume > pocVolume) {
            pocVolume = split.volume;
            pocIdx = b;
        }
    }

    return { buckets, pocIdx, rows, totalVolume };
}

function splitVolume(
    rawUp: number,
    rawDown: number,
    volumeSplit: VolumeSplit,
): { upVolume: number; downVolume: number; volume: number } {
    switch (volumeSplit) {
        case "total": {
            const volume = rawUp + rawDown;
            return { downVolume: 0, upVolume: volume, volume };
        }
        case "delta": {
            const upVolume = Math.max(0, rawUp - rawDown);
            const downVolume = Math.max(0, rawDown - rawUp);
            return { downVolume, upVolume, volume: upVolume + downVolume };
        }
        case "upDown":
            return { downVolume: rawDown, upVolume: rawUp, volume: rawUp + rawDown };
    }
}
