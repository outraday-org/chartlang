// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

export {
    commitStateSlots,
    flushStateSlots,
    restoreStateSlots,
    resetTentativeStateSlots,
    serialiseStateSlots,
} from "./lifecycle.js";
export type { StateSlotSnapshot } from "./lifecycle.js";
export { buildStateNamespace } from "./stateNamespace.js";
export type { StateSlotSerialisers } from "./stateSlot.js";
export { asMutableSlot, StateSlot } from "./stateSlot.js";
