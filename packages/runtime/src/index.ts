// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

export { Float64RingBuffer, RingBuffer } from "./ringBuffer";
export type { RingBufferLike } from "./ringBuffer";
export { makeSeriesView, makeShiftedSeriesView } from "./seriesView";
export type { BarView, OhlcvBuffers, StreamState } from "./streamState";
export { createStreamState } from "./streamState";
export type { StateStore } from "./stateStore";
export { inMemoryStateStore } from "./stateStore";
export type { PersistentStateStore } from "./persistentStateStore";
export { inMemoryPersistentStateStore } from "./persistentStateStore";
export { asMutableSlot, buildStateNamespace, StateSlot } from "./state";
export { resolveInputs } from "./inputs";
export { buildRequestNamespace, makeNanSecurityBar } from "./request";
export type { DrawingSlot, MutableRunnerEmissions, RuntimeContext } from "./runtimeContext";
export {
    createRuntimeViews,
    makeBarStateView,
    makeSymInfoView,
    makeTimeframeView,
} from "./views";
export type { AdapterSymInfo, BarStateInputs, EventKind, RuntimeViews } from "./views";
export { ACTIVE_RUNTIME_CONTEXT } from "./runtimeContext";
export { createScriptRunner } from "./createScriptRunner";
export type { CreateScriptRunnerArgs, ScriptRunner } from "./createScriptRunner";
export { alert, draw, hline, plot, pushDrawing } from "./emit";
export { TA_REGISTRY, ta } from "./ta";
export { maRibbonOutputKeys } from "./ta";
export type { RuntimeTaNamespace, ScalarOrSeries } from "./ta";
// Public re-export added in Phase 3 Task 10 so consumer adapters that
// render `draw.regressionTrend` can compute the OLS fit without
// duplicating math. The Phase-2 helper signature stays
// `(source: Float64Array, length: number): LinearRegressionFrame` —
// pass `length === source.length` for a single-window fit over the
// bar range; the line value at the last index is the end-of-range fit.
export { linearRegression } from "./ta/lib/linearRegression";
export type { LinearRegressionFrame } from "./ta/lib/linearRegression";
