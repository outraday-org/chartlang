// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// Ported from ../invinite/src/components/trading-chart/indicators/lib/volume-profile/volume-profile-shared.ts
//   @ 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4.
// Translated, not transcribed — ReadonlyArray<number> inputs, JSDoc, runtime.
// See packages/runtime/src/ta/CLAUDE.md for the port convention.

export { buildBucketEdges } from "./bucketEdges.js";
export { bucketizeVolume, bucketizeVolumeDetailed } from "./bucketizeVolume.js";
export { computeDevelopingSeries, derivePriceRange } from "./developingSeries.js";
export { findInterceptIndex } from "./intercept.js";
export {
    assessVolumeProfileCost,
    VOLUME_PROFILE_HEAVY_THRESHOLD,
    VOLUME_PROFILE_MAX_BUCKETS,
} from "./tooHeavy.js";
export { DEFAULT_TICK_SIZE } from "./types.js";
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
} from "./types.js";
export { computeValueArea } from "./valueArea.js";
export { computeProfile, sliceBarsByTime } from "./volumeProfileShared.js";
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
} from "./scaffold.js";
