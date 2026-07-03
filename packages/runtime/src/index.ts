// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

export { Float64RingBuffer, RingBuffer } from "./ringBuffer.js";
export type { RingBufferLike } from "./ringBuffer.js";
export { makeSeriesView, makeShiftedSeriesView, seriesOffsetOf } from "./seriesView.js";
export type { BarView, OhlcvBuffers, StreamState } from "./streamState.js";
export { createStreamState } from "./streamState.js";
export type { StateStore } from "./stateStore.js";
export { inMemoryStateStore } from "./stateStore.js";
export type { PersistentStateStore } from "./persistentStateStore.js";
export { inMemoryPersistentStateStore } from "./persistentStateStore.js";
export { asMutableSlot, buildStateNamespace, StateSlot } from "./state/index.js";
export { resolveInputs } from "./inputs/index.js";
export { buildRequestNamespace, makeNanSecurityBar } from "./request/index.js";
export type { DrawingSlot, MutableRunnerEmissions, RuntimeContext } from "./runtimeContext.js";
export {
    createRuntimeViews,
    makeBarStateView,
    makeSymInfoView,
    makeTimeframeView,
} from "./views/index.js";
export type { AdapterSymInfo, BarStateInputs, EventKind, RuntimeViews } from "./views/index.js";
export { ACTIVE_RUNTIME_CONTEXT } from "./runtimeContext.js";
export { createScriptRunner } from "./createScriptRunner.js";
export type { CreateScriptRunnerArgs, ScriptRunner } from "./createScriptRunner.js";
export { buildBundleFromModule } from "./loadBundle.js";
export type { CompiledModuleExport } from "./loadBundle.js";
export { alert, applyPlotOverride, draw, hline, plot, pushDrawing } from "./emit/index.js";
export { TA_REGISTRY, ta } from "./ta/index.js";
export { maRibbonOutputKeys } from "./ta/index.js";
export type { RuntimeTaNamespace, ScalarOrSeries } from "./ta/index.js";
// Public re-export added in Phase 3 Task 10 so consumer adapters that
// render `draw.regressionTrend` can compute the OLS fit without
// duplicating math. The Phase-2 helper signature stays
// `(source: Float64Array, length: number): LinearRegressionFrame` —
// pass `length === source.length` for a single-window fit over the
// bar range; the line value at the last index is the end-of-range fit.
export { linearRegression } from "./ta/lib/linearRegression.js";
export type { LinearRegressionFrame } from "./ta/lib/linearRegression.js";
// Indicator-composition surface (Phase 7).
export type {
    CreateDepRunnerArgs,
    DepOutputDeclaration,
    DepOutputStore,
    DepRunner,
    DepRunnerLike,
    SiblingRunner,
    SiblingRunnerLike,
} from "./dep/index.js";
export {
    applyDepEmissionPolicy,
    createDepOutputStore,
    createDepRunner,
    createSiblingRunner,
    runDepStep,
    runSiblingStep,
} from "./dep/index.js";
