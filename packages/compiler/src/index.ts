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
} from "./api";
export type {
    CompileFileOptions,
    CompileOptions,
    CompiledScript,
    TransformAndAnalyseOptions,
    TransformAndAnalyseResult,
} from "./api";
export { bundleModule, formatManifestAssignment } from "./bundle";
export type { BundleModuleOptions, BundleModuleResult } from "./bundle";
export type { CompileDiagnostic, CompileDiagnosticCode } from "./diagnostics";
export { emitTypes } from "./typesEmit";
export type { EmitTypesOptions } from "./typesEmit";
export { resolveCalleeName } from "./transformers/resolveCallee";
