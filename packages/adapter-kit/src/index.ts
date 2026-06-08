// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

export { KIND_BUCKET, bucketFor } from "@invinite-org/chartlang-core";
export type { DrawingBucket, DrawingState } from "@invinite-org/chartlang-core";
export { defineAdapter } from "./defineAdapter";
export type { DefineAdapterOpts } from "./defineAdapter";
export { capabilities } from "./capabilities";
export { decodeDrawing, validateEmission } from "./validation";
export type { ValidationFail, ValidationOk, ValidationResult } from "./validation";
export { mockCandleSource } from "./mocks";
export type { MockCandleSourceMode, MockCandleSourceOpts } from "./mocks";
export { BufferingAdapter, PassThroughAdapter } from "./base";
export type {
    Adapter,
    AdapterSymInfo,
    AlertChannel,
    AlertEmission,
    Capabilities,
    CandleEvent,
    DiagnosticCode,
    DrawingCounts,
    DrawingEmission,
    DrawingKind,
    InputKind,
    PlotEmission,
    PlotKind,
    PlotStyle,
    RunnerEmissions,
    RuntimeDiagnostic,
    SymInfoField,
} from "./types";
