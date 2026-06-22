// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

export { runStructuralChecks } from "./structuralChecks.js";
export type { StructuralBindingInfo, StructuralCheckResult } from "./structuralChecks.js";
export { runForbiddenConstructs } from "./forbiddenConstructs.js";
export { runStatefulCallInLoop } from "./statefulCallInLoop.js";
export { MAX_STATE_ARRAY_CAPACITY, runStateArrayCapacity } from "./stateArrayCapacity.js";
export { extractCapabilities } from "./extractCapabilities.js";
export { extractMaxLookback } from "./extractMaxLookback.js";
export type { ExtractMaxLookbackResult } from "./extractMaxLookback.js";
export { extractInputs } from "./extractInputs.js";
export type { ExtractedDescriptor, ExtractInputsResult } from "./extractInputs.js";
export { extractRequestAnalysis, extractRequestedIntervals } from "./extractRequestedIntervals.js";
export type { RequestAnalysis } from "./extractRequestedIntervals.js";
export { validateSecurityExpr } from "./validateSecurityExpr.js";
export { validateLowerTfIntervals } from "./validateLowerTfIntervals.js";
export { extractRequiresIntervals } from "./extractRequiresIntervals.js";
export { extractAlertConditions } from "./extractAlertConditions.js";
export type { ExtractAlertConditionsResult } from "./extractAlertConditions.js";
export { extractDependencyGraph } from "./extractDependencyGraph.js";
export type {
    DepConsumesEntry,
    DepGraph,
    DrawnScript,
    PrivateDep,
    ProducerRef,
    ProducerSnapshot,
    ResolveProducer,
} from "./extractDependencyGraph.js";
