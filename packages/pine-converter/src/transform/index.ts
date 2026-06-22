// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

export { resolveCoordinates, resolveAnchorExpr, anchorToWorldPoint } from "./coordinates.js";
export type { CoordinateResolution, ResolvedAnchor } from "./coordinates.js";
export { emitExpr, forEachHistoryAccess } from "./exprEmit.js";
export type { AnnotationLookup } from "./exprEmit.js";
export { DiagnosticCollector } from "./diagnosticCollector.js";
export { transformDeclaration } from "./declaration.js";
export { mapDeclarationArgs, FALLBACK_INDICATOR_NAME } from "./declarationArgs.js";
export type { ScaffoldOptions } from "./declarationArgs.js";
export {
    appendInput,
    appendStateSlot,
    appendComputeStatement,
    appendHandleSlot,
    appendHandleRing,
} from "./scaffoldMutators.js";
export { transformInputs } from "./inputs.js";
export { pineTimeframeToInterval, intervalToPineTimeframe } from "./timeframeConvert.js";
export { transformCampA } from "./campA.js";
export { handleSlotLocalName, synthesizeDrawCall } from "./handleSlot.js";
export type { ChartlangDrawKind, DrawCallContext } from "./handleSlot.js";
export { foldSetters, renderEnumTarget } from "./setterFold.js";
export type { SetterCall, SetterWarn } from "./setterFold.js";
export { resolveYloc } from "./ylocResolve.js";
export type { YlocResolution } from "./ylocResolve.js";
export { resolveCampADrawKind } from "./drawKindResolve.js";
export { transformCampB } from "./campB.js";
export { ringLocalName, registerRing, resolveRingCap, CHARTLANG_BUCKET_CAP } from "./ringHelper.js";
export type { RingBucket } from "./ringHelper.js";
export { mapArrayBuiltin } from "./arrayBuiltinMap.js";
export type { ArrayBuiltinResult } from "./arrayBuiltinMap.js";
export { transformCampC } from "./campC.js";
export { tryHeuristics } from "./campCHeuristics.js";
export type { HeuristicResult } from "./campCHeuristics.js";
export { CAMP_C_REJECTS, rejectSuggestion } from "./campCRejects.js";
export type { CampCContext, RejectCode, RejectEntry, SuggestionFn } from "./campCRejects.js";
export { transformTables } from "./tables.js";
export type { CellSpec } from "./tables.js";
export { transformPolylineLinefill } from "./polylineLinefill.js";
export { convertColor, transpToAlphaHex } from "./colorConvert.js";
export { transformOther } from "./other.js";
export { scanNumericArrays } from "./numericArray.js";
export type { NumericArrayScan } from "./numericArray.js";
export { emitWithContext } from "./emitContext.js";
export type { EmitContext } from "./emitContext.js";
export {
    callIsStatefulPrimitive,
    expressionHasStatefulPrimitive,
} from "./statefulNames.js";
export { emitIf, emitFor, emitSwitch, substituteIterator, resolveBound } from "./controlFlow.js";
export type { BodyEmitter, ResolvedBound } from "./controlFlow.js";
export { parsePineFormat, emitStr } from "./strFormat.js";
export type { StrResult } from "./strFormat.js";
export { emitPlotFamily, isPlotFamilyCall } from "./plotFamily.js";
export { emitRequestSecurity, isRequestSecurityCall } from "./requestSecurity.js";
export { emitStrategySignal, isStrategySignalCall } from "./strategySignals.js";
export type {
    ScriptScaffold,
    ComputeBodyIR,
    StateSlotIR,
    HandleSlotIR,
    HandleRingIR,
    InputDeclarationIR,
    MaxDrawingsIR,
    ScaffoldFormat,
    ScaffoldScale,
} from "./ir.js";
