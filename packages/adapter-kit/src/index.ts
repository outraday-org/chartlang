// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

export { KIND_BUCKET, bucketFor, feedKey } from "@invinite-org/chartlang-core";
export type { DrawingBucket, DrawingState } from "@invinite-org/chartlang-core";
export { defineAdapter } from "./defineAdapter.js";
export type { DefineAdapterOpts } from "./defineAdapter.js";
export { PHASE_5_PLOT_KINDS, capabilities } from "./capabilities/index.js";
export { decodeDrawing, validateEmission } from "./validation/index.js";
export type { ValidationFail, ValidationOk, ValidationResult } from "./validation/index.js";
export { mockCandleSource } from "./mocks/index.js";
export type { MockCandleSourceMode, MockCandleSourceOpts } from "./mocks/index.js";
export { BufferingAdapter, PassThroughAdapter } from "./base/index.js";
export { decomposeDrawing, priceToY, timeToX, worldPointToPixel } from "./geometry/index.js";
export {
    maxShiftedTime,
    medianBarSpacing,
    projectShiftedX,
    shiftedBarIndex,
    shiftedBarTime,
} from "./geometry/index.js";
export type {
    DrawPrimitive,
    FillStyle,
    Point2,
    StrokeStyle,
    Viewport,
} from "./geometry/index.js";
export {
    attachInteraction,
    createViewController,
    onDblCore,
    onDragCore,
    onWheelCore,
    yRangeInWindow,
} from "./interaction/index.js";
export type {
    InteractionHandlers,
    ViewController,
    ViewControllerOpts,
    WindowYInput,
    XWindow,
} from "./interaction/index.js";
export type {
    Adapter,
    AdapterSymInfo,
    AlertChannel,
    AlertConditionEmission,
    AlertEmission,
    Capabilities,
    CandleEvent,
    DiagnosticCode,
    DrawingCounts,
    DrawingEmission,
    DrawingKind,
    InputKind,
    LogEmission,
    PlotEmission,
    PlotKind,
    PlotOverride,
    PlotSlotDescriptor,
    PlotStyle,
    RunnerEmissions,
    RuntimeDiagnostic,
    SymInfoField,
} from "./types.js";
