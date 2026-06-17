// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

export { emit } from "./emit.js";
export { emitImports } from "./emitImports.js";
export { emitInputs } from "./emitInputs.js";
export { emitMaxDrawings } from "./emitMaxDrawings.js";
export { emitCompute } from "./emitCompute.js";
export {
    emitBarIndexPreamble,
    emitBarIntervalConst,
    emitHandleSlotHelper,
    emitHandleRingHelper,
    emitSlotAllocations,
} from "./emitHelpers.js";
export { formatSource } from "./format.js";
export { scaffoldToManifest } from "./manifest.js";
export { scanUsage } from "./usage.js";
export type { UsageFlags } from "./usage.js";
