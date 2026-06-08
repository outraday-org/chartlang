// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ScriptManifest } from "@invinite-org/chartlang-core";
import { expectTypeOf } from "expect-type";
import type ts from "typescript";
import { describe, it } from "vitest";

import {
    type CompileFileOptions,
    type CompileOptions,
    type CompiledScript,
    type TransformAndAnalyseOptions,
    type TransformAndAnalyseResult,
    compile,
    compileFile,
    compileProject,
    transformAndAnalyse,
} from "./api";
import type { CompileDiagnostic, CompileDiagnosticCode } from "./diagnostics";

describe("transformAndAnalyse — types", () => {
    it("accepts a source string + TransformAndAnalyseOptions", () => {
        expectTypeOf(transformAndAnalyse).parameter(0).toEqualTypeOf<string>();
        expectTypeOf(transformAndAnalyse).parameter(1).toEqualTypeOf<TransformAndAnalyseOptions>();
    });

    it("returns a TransformAndAnalyseResult with the documented shape", () => {
        expectTypeOf(transformAndAnalyse).returns.toEqualTypeOf<TransformAndAnalyseResult>();
        expectTypeOf<TransformAndAnalyseResult["transformed"]>().toEqualTypeOf<ts.SourceFile>();
        expectTypeOf<TransformAndAnalyseResult["manifest"]>().toEqualTypeOf<ScriptManifest>();
        expectTypeOf<TransformAndAnalyseResult["diagnostics"]>().toEqualTypeOf<
            ReadonlyArray<CompileDiagnostic>
        >();
    });

    it("CompileDiagnosticCode union covers the documented codes", () => {
        type Codes =
            | "unbounded-loop"
            | "recursion-not-allowed"
            | "hostile-global"
            | "stateful-call-inside-loop"
            | "stateful-call-element-access"
            | "request-security-interval-not-literal"
            | "dynamic-series-index"
            | "callsite-id-conflict"
            | "missing-default-export"
            | "api-version-mismatch"
            | "input-default-not-literal"
            | "unknown-input-kind"
            | "multiple-input-interval";
        expectTypeOf<CompileDiagnosticCode>().toEqualTypeOf<Codes>();
    });
});

describe("compile / compileFile / compileProject — types", () => {
    it("compile accepts (string, CompileOptions) and returns Promise<CompiledScript>", () => {
        expectTypeOf(compile).parameter(0).toEqualTypeOf<string>();
        expectTypeOf(compile).parameter(1).toEqualTypeOf<CompileOptions>();
        expectTypeOf(compile).returns.toEqualTypeOf<Promise<CompiledScript>>();
    });

    it("compileFile accepts (string, CompileFileOptions) and returns Promise<CompiledScript>", () => {
        expectTypeOf(compileFile).parameter(0).toEqualTypeOf<string>();
        expectTypeOf(compileFile).parameter(1).toEqualTypeOf<CompileFileOptions>();
        expectTypeOf(compileFile).returns.toEqualTypeOf<Promise<CompiledScript>>();
    });

    it("compileProject returns Promise<ReadonlyArray<CompiledScript>>", () => {
        expectTypeOf(compileProject).parameter(0).toEqualTypeOf<string>();
        expectTypeOf(compileProject).parameter(1).toEqualTypeOf<CompileOptions>();
        expectTypeOf(compileProject).returns.toEqualTypeOf<
            Promise<ReadonlyArray<CompiledScript>>
        >();
    });

    it("CompiledScript has the documented frozen shape", () => {
        expectTypeOf<CompiledScript["moduleSource"]>().toEqualTypeOf<string>();
        expectTypeOf<CompiledScript["sourcemap"]>().toEqualTypeOf<string | undefined>();
        expectTypeOf<CompiledScript["manifest"]>().toEqualTypeOf<ScriptManifest>();
        expectTypeOf<CompiledScript["types"]>().toEqualTypeOf<string>();
    });
});
