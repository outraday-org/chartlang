// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

export {
    commitStateSlots,
    flushStateSlots,
    resetTentativeStateSlots,
} from "./lifecycle";
export type { StateSlotSnapshot } from "./lifecycle";
export { buildStateNamespace } from "./stateNamespace";
export { asMutableSlot, StateSlot } from "./stateSlot";
