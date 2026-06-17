// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

export { resolveCoordinates } from "./coordinates.js";
export type { CoordinateResolution, ResolvedAnchor } from "./coordinates.js";
export { emitExpr } from "./exprEmit.js";
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
