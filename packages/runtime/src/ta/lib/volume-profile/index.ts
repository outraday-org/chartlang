// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// Ported from ../invinite/src/components/trading-chart/indicators/lib/volume-profile/volume-profile-shared.ts
//   @ 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4.
// Translated, not transcribed — ReadonlyArray<number> inputs, JSDoc, runtime.
// See packages/runtime/src/ta/CLAUDE.md for the port convention.

export { buildBucketEdges } from "./bucketEdges";
export { bucketizeVolume, bucketizeVolumeDetailed } from "./bucketizeVolume";
export { computeDevelopingSeries, derivePriceRange } from "./developingSeries";
export { findInterceptIndex } from "./intercept";
export {
    assessVolumeProfileCost,
    VOLUME_PROFILE_HEAVY_THRESHOLD,
    VOLUME_PROFILE_MAX_BUCKETS,
} from "./tooHeavy";
export { DEFAULT_TICK_SIZE } from "./types";
export type {
    BucketizedVolume,
    DevelopingProfileSeries,
    VolumeProfileConfig as ProfileConfig,
    RowsLayout,
    ValueAreaResult,
    VolumeProfileBar,
    VolumeProfileBucket,
    VolumeProfileConfig,
    VolumeProfileCostStatus,
    VolumeProfileResult,
    VolumeProfileRow,
    VolumeSplit,
} from "./types";
export { computeValueArea } from "./valueArea";
export { computeProfile, sliceBarsByTime } from "./volumeProfileShared";
export {
    commitVolumeProfileSnapshot,
    createVolumeProfileCore,
    degenerateVolumeProfile,
    emitVolumeProfileHistogram,
    emptyVolumeProfileSnapshot,
    resolveVolumeProfileSnapshot,
    type HistogramBucket,
    type VolumeProfileCore,
    type VolumeProfileSnapshot,
    volumeProfileConfigFromOpts,
} from "./scaffold";
