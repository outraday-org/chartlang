// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// Ported from ../invinite/src/components/trading-chart/indicators/lib/volume-profile/too-heavy.ts
//   @ 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4.
// Translated, not transcribed — ReadonlyArray<number> inputs, JSDoc, runtime.
// See packages/runtime/src/ta/CLAUDE.md for the port convention.

import type { RowsLayout, VolumeProfileCostStatus } from "./types";

/**
 * Finer-bar count threshold from the invinite profile renderer.
 *
 * @formula PLAN §9.2 — cap finer-bar scans for one profile compute.
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // const max = VOLUME_PROFILE_HEAVY_THRESHOLD;
 */
export const VOLUME_PROFILE_HEAVY_THRESHOLD = 50_000;

/**
 * Default maximum bucket count for a single pure profile compute.
 *
 * @formula PLAN §9.2 — cap bucket allocations for one profile compute.
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // const max = VOLUME_PROFILE_MAX_BUCKETS;
 */
export const VOLUME_PROFILE_MAX_BUCKETS = 2_000;

/**
 * Assess whether a volume-profile input window is too expensive and
 * optionally recommend a coarser `rowSize` fallback.
 *
 * @formula PLAN §9.2 — guard range / rowSize combinations that would
 *          allocate pathological bucket counts before bucketing.
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // const status = assessVolumeProfileCost({ finerCandleCount: 1000, priceMin: 1, priceMax: 100, rowSize: 1, rowsLayout: "numberOfRows" });
 */
export function assessVolumeProfileCost(args: {
    finerCandleCount: number;
    rowSize?: number;
    rowsLayout?: RowsLayout;
    tickSize?: number;
    priceMin?: number;
    priceMax?: number;
    maxBuckets?: number;
}): VolumeProfileCostStatus {
    if (args.finerCandleCount > VOLUME_PROFILE_HEAVY_THRESHOLD) {
        return { heavy: true, reason: "too-many-finer-bars", recommendedRowSize: null };
    }

    const maxBuckets = args.maxBuckets ?? VOLUME_PROFILE_MAX_BUCKETS;
    const estimate = estimateBucketCount(args);
    if (estimate.kind === "estimated" && estimate.bucketCount > maxBuckets) {
        return {
            heavy: true,
            reason: "too-many-buckets",
            recommendedRowSize:
                args.rowsLayout === "ticksPerRow"
                    ? Math.ceil(
                          (estimate.priceMax - estimate.priceMin) /
                              (maxBuckets * estimate.tickSize),
                      )
                    : Math.max(1, maxBuckets),
        };
    }

    return { heavy: false, reason: null, recommendedRowSize: null };
}

function estimateBucketCount(args: {
    rowSize?: number;
    rowsLayout?: RowsLayout;
    tickSize?: number;
    priceMin?: number;
    priceMax?: number;
}):
    | { bucketCount: 0; kind: "invalid" }
    | {
          bucketCount: number;
          kind: "estimated";
          priceMin: number;
          priceMax: number;
          rowSize: number;
          tickSize: number;
      } {
    const { priceMax, priceMin, rowSize } = args;
    if (
        rowSize === undefined ||
        priceMin === undefined ||
        priceMax === undefined ||
        !Number.isFinite(priceMin) ||
        !Number.isFinite(priceMax) ||
        rowSize <= 0 ||
        priceMax <= priceMin
    ) {
        return { bucketCount: 0, kind: "invalid" };
    }
    const tickSize = args.tickSize ?? 0.01;
    if (args.rowsLayout === "ticksPerRow") {
        const width = rowSize * tickSize;
        return width > 0
            ? {
                  bucketCount: Math.ceil((priceMax - priceMin) / width),
                  kind: "estimated",
                  priceMax,
                  priceMin,
                  rowSize,
                  tickSize,
              }
            : { bucketCount: 0, kind: "invalid" };
    }
    return {
        bucketCount: Math.floor(rowSize),
        kind: "estimated",
        priceMax,
        priceMin,
        rowSize,
        tickSize,
    };
}
