// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// Ported from ../invinite/src/components/trading-chart/indicators/lib/volume-profile/types.ts
//   @ 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4.
// Translated, not transcribed — ReadonlyArray<number> inputs, JSDoc, runtime.
// See packages/runtime/src/ta/CLAUDE.md for the port convention.

/**
 * Bucket-width strategy. `ticksPerRow` derives from `tickSize`;
 * `numberOfRows` divides the range evenly.
 *
 * @formula PLAN §9.2 — controls bucket width derivation for profile rows.
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // const layout: RowsLayout = "numberOfRows";
 */
export type RowsLayout = "numberOfRows" | "ticksPerRow";

/**
 * Bar coloring strategy inside each bucket.
 *
 * @formula PLAN §9.2 — selects total, delta, or up/down volume partitioning.
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // const split: VolumeSplit = "upDown";
 */
export type VolumeSplit = "delta" | "total" | "upDown";

/**
 * Minimal OHLCV shape consumed by the pure volume-profile helpers.
 *
 * @formula PLAN §9.2 — normalized OHLCV input for profile bucketing.
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // const bar: VolumeProfileBar = { time: 0, open: 1, high: 2, low: 1, close: 2, volume: 100 };
 */
export type VolumeProfileBar = Readonly<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}>;

/**
 * Horizontal-histogram bucket shape used by Phase 5 plot emissions.
 *
 * @formula PLAN §9.2 — price row plus accumulated volume.
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // const bucket: VolumeProfileBucket = { price: 100, volume: 25 };
 */
export type VolumeProfileBucket = Readonly<{
    price: number;
    volume: number;
}>;

/**
 * Internal row shape retaining bucket bounds and directional volume.
 *
 * @formula PLAN §9.2 — bucket bounds plus directional volume totals.
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // const row: VolumeProfileRow = { low: 99, high: 101, mid: 100, volume: 10, upVolume: 10, downVolume: 0 };
 */
export type VolumeProfileRow = Readonly<{
    low: number;
    high: number;
    mid: number;
    volume: number;
    upVolume: number;
    downVolume: number;
}>;

/**
 * Shared math config consumed by bucket/value-area/developing helpers.
 *
 * @formula PLAN §9.2 — shared profile row count and value-area settings.
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // const config: VolumeProfileConfig = { rowSize: 24, valueAreaPct: 70 };
 */
export type VolumeProfileConfig = Readonly<{
    rowSize: number;
    valueAreaPct: number;
    rowsLayout?: RowsLayout;
    volumeSplit?: VolumeSplit;
    tickSize?: number;
}>;

/**
 * Cost guard result for profile windows that would allocate too many
 * buckets or scan too many finer bars.
 *
 * @formula PLAN §9.2 — cost guard state for profile windows.
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // const status: VolumeProfileCostStatus = { heavy: false, reason: null, recommendedRowSize: null };
 */
export type VolumeProfileCostStatus = Readonly<{
    heavy: boolean;
    reason: "too-many-buckets" | "too-many-finer-bars" | null;
    recommendedRowSize: number | null;
}>;

/**
 * Value-area result: high/low price bounds plus point-of-control.
 *
 * @formula PLAN §9.2 — point-of-control and value-area bounds.
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // const va: ValueAreaResult = { valHigh: 101, valLow: 99, poc: 100, vahIdx: 1, valIdx: 0, pocIdx: 0, cumulativeVolume: 10 };
 */
export type ValueAreaResult = Readonly<{
    valHigh: number;
    valLow: number;
    poc: number;
    vahIdx: number;
    valIdx: number;
    pocIdx: number;
    cumulativeVolume: number;
}>;

/**
 * Detailed bucketization output.
 *
 * @formula PLAN §9.2 — raw histogram buckets and total volume.
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // const out: BucketizedVolume = { buckets: [], rows: [], totalVolume: 0, pocIdx: -1 };
 */
export type BucketizedVolume = Readonly<{
    buckets: ReadonlyArray<VolumeProfileBucket>;
    rows: ReadonlyArray<VolumeProfileRow>;
    totalVolume: number;
    pocIdx: number;
}>;

/**
 * Developing POC/value-area time-series arrays.
 *
 * @formula PLAN §9.2 — developing profile time-series outputs.
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // const dev: DevelopingProfileSeries = { developingPoc: new Float64Array(0), developingVahHigh: new Float64Array(0), developingVahLow: new Float64Array(0) };
 */
export type DevelopingProfileSeries = Readonly<{
    developingPoc: Float64Array;
    developingVahHigh: Float64Array;
    developingVahLow: Float64Array;
}>;

/**
 * Full pure profile result consumed by later volume-profile primitives.
 *
 * @formula PLAN §9.2 — complete profile histogram, value area, and cost state.
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // const result: VolumeProfileResult = { buckets: [], rows: [], valueAreaMask: new Float64Array(0), poc: Number.NaN, valHigh: Number.NaN, valLow: Number.NaN, costStatus: { heavy: false, reason: null, recommendedRowSize: null } };
 */
export type VolumeProfileResult = Readonly<{
    buckets: ReadonlyArray<VolumeProfileBucket>;
    rows: ReadonlyArray<VolumeProfileRow>;
    valueAreaMask: Float64Array;
    poc: number;
    valHigh: number;
    valLow: number;
    costStatus: VolumeProfileCostStatus;
    developing?: DevelopingProfileSeries;
}>;

/**
 * Sentinel tick size used when no symbol-specific minimum tick is supplied.
 *
 * @formula PLAN §9.2 — fallback row quantum for symbols without min tick.
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // const tick = DEFAULT_TICK_SIZE;
 */
export const DEFAULT_TICK_SIZE = 0.01;
