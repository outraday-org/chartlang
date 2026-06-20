// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

export { LWC_CAPABILITIES, LWC_SYM_INFO } from "./capabilities.js";
export { DEFAULT_ADAPTER } from "./defaultAdapter.js";
export { DEFAULT_ADAPTER as default } from "./defaultAdapter.js";
export {
    createLightweightChartsAdapter,
    runRendererLoop,
} from "./createLightweightChartsAdapter.js";
export type {
    CreateLightweightChartsAdapterOpts,
    LwcAdapterHandle,
    RunRendererLoopOpts,
} from "./createLightweightChartsAdapter.js";
export { DrawingPrimitive } from "./drawingPrimitive.js";
export type {
    BitmapDrawTarget,
    DrawingPrimitiveAttach,
    PaintScope,
} from "./drawingPrimitive.js";
export { buildViewport } from "./viewport.js";
export type {
    BitmapScope,
    LwcSeriesProjector,
    LwcTimeScaleProjector,
} from "./viewport.js";
