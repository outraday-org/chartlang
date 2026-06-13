// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

export {
    CompileError,
    compile,
    compileFile,
    compileProject,
    transformAndAnalyse,
    walkChartFiles,
    writeAtomic,
} from "./api.js";
export type {
    CompileFileOptions,
    CompileOptions,
    CompiledScript,
    TransformAndAnalyseOptions,
    TransformAndAnalyseResult,
} from "./api.js";
export { bundleModule, formatManifestAssignment } from "./bundle.js";
export type {
    BundleModuleOptions,
    BundleModuleResult,
    InlinedProducer,
} from "./bundle.js";
export {
    createProducerResolver,
    hashSourcePath,
    rewriteProducerSource,
} from "./dependency/index.js";
export type {
    CompiledProducerArtefacts,
    CompileProducerCallback,
    CreateProducerResolverOptions,
    ProducerCompiled,
    ResolveCrossFileProducer,
} from "./dependency/index.js";
export type { CompileDiagnostic, CompileDiagnosticCode } from "./diagnostics.js";
export { emitTypes } from "./typesEmit.js";
export type { EmitTypesOptions } from "./typesEmit.js";
export { resolveCalleeName } from "./transformers/resolveCallee.js";
