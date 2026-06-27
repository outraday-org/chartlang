// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

export {
    isArraySlotSnapshotKey,
    restoreArraySlots,
    serialiseArraySlots,
} from "./arrayPersistence.js";
export { ArrayStateSlot } from "./arrayStateSlot.js";
export {
    advanceObjectSeriesSlots,
    advanceSeriesSlots,
    commitArraySlots,
    commitMapSlots,
    commitObjectSeriesSlots,
    commitSeriesSlots,
    commitStateSlots,
    flushStateSlots,
    resetObjectSeriesHeads,
    resetSeriesHeads,
    resetTentativeArraySlots,
    resetTentativeMapSlots,
    restoreStateSlots,
    resetTentativeStateSlots,
    serialiseStateSlots,
} from "./lifecycle.js";
export {
    isObjectSeriesSlotSnapshotKey,
    restoreObjectSeriesSlots,
    serialiseObjectSeriesSlots,
} from "./objectSeriesPersistence.js";
export type {
    ObjectSeriesKind,
    ObjectSeriesSlot,
    ObjectSeriesSlotView,
} from "./objectSeriesSlot.js";
export {
    isMapSlotSnapshotKey,
    restoreMapSlots,
    serialiseMapSlots,
} from "./mapPersistence.js";
export { MapStore } from "./mapStore.js";
export type { StateSlotSnapshot } from "./lifecycle.js";
export {
    isSeriesSlotSnapshotKey,
    restoreSeriesSlots,
    serialiseSeriesSlots,
} from "./seriesPersistence.js";
export { buildStateNamespace } from "./stateNamespace.js";
export type { StateSlotSerialisers } from "./stateSlot.js";
export { asMutableSlot, StateSlot } from "./stateSlot.js";
