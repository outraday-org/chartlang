// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type ts from "typescript";

/**
 * Stable identifier for every diagnostic the compiler can emit. New codes are
 * added at the end; existing codes never change meaning so consumer-side
 * filtering stays compatible across versions.
 *
 * Phase 1 ships eight emittable codes plus Phase 4's
 * `request.security` and input-extraction codes.
 *
 * @since 0.1
 * @example
 *     const code: CompileDiagnosticCode = "unbounded-loop";
 */
export type CompileDiagnosticCode =
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
    | "multiple-input-interval"
    | "requires-intervals-not-literal"
    | "alert-condition-not-literal"
    | "alert-condition-field-not-literal"
    | "lower-tf-not-lower"
    | "request-lower-tf-interval-not-literal"
    | "type-error";

/**
 * Single diagnostic the compiler emits while transforming or analysing a
 * `.chart.ts` source. The shape is intentionally small — file/line/column and
 * a stable code — so callers (CLI, editor, host) can format errors uniformly.
 *
 * `severity` distinguishes hard errors (abort `compile`) from warnings
 * (surface to the user but still produce a manifest).
 *
 * @since 0.1
 * @example
 *     const d: CompileDiagnostic = {
 *         severity: "error",
 *         code: "unbounded-loop",
 *         message: "while loops are not allowed",
 *         file: "demo.chart.ts",
 *         line: 5,
 *         column: 1,
 *     };
 */
export type CompileDiagnostic = {
    readonly severity: "error" | "warning";
    readonly code: CompileDiagnosticCode;
    readonly message: string;
    readonly file: string;
    readonly line: number;
    readonly column: number;
    readonly nodeText?: string;
};

/**
 * Build a frozen `CompileDiagnostic` from a TypeScript node. Reads the node's
 * starting position against the supplied source file, converts to 1-based
 * line/column, and truncates the source snippet to a single line so terminal
 * output stays compact.
 *
 * @since 0.1
 * @example
 *     // Inside an analysis pass:
 *     //   diagnostics.push(createDiagnostic({
 *     //       severity: "error", code: "unbounded-loop",
 *     //       message: "while loops are not allowed",
 *     //       file: sourcePath, node, sourceFile,
 *     //   }));
 *     const fake = { severity: "error" as const };
 *     void fake;
 */
export function createDiagnostic(args: {
    readonly severity: "error" | "warning";
    readonly code: CompileDiagnosticCode;
    readonly message: string;
    readonly file: string;
    readonly node: ts.Node;
    readonly sourceFile: ts.SourceFile;
    readonly includeSnippet?: boolean;
}): CompileDiagnostic {
    const { severity, code, message, file, node, sourceFile, includeSnippet } = args;
    const start = node.getStart(sourceFile);
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(start);
    const base = {
        severity,
        code,
        message,
        file,
        line: line + 1,
        column: character + 1,
    };
    if (includeSnippet) {
        const text = node.getText(sourceFile);
        const newlineIndex = text.indexOf("\n");
        const firstLine = newlineIndex === -1 ? text : text.slice(0, newlineIndex);
        const snippet = firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
        return Object.freeze({ ...base, nodeText: snippet });
    }
    return Object.freeze(base);
}

/**
 * Build a frozen `CompileDiagnostic` from a raw TypeScript `ts.Diagnostic`.
 * Used by the `compile()` pipeline to surface semantic type-checker errors
 * (TS2322, TS2345, …) under the `type-error` code. Carries the original
 * `TS<code>` numeric prefix in the message so editor consumers can route
 * to the TypeScript documentation if they want.
 *
 * Diagnostics without a `file` (global-scope, project-shape) are mapped to
 * the script's `sourcePath` at line/column `1:1` so callers always get a
 * stable location they can attribute to the user's source. The message is
 * flattened across `DiagnosticMessageChain` nodes.
 *
 * @since 0.7
 * @example
 *     // const compileDiagnostic = mapTsDiagnostic(tsDiagnostic, "demo.chart.ts");
 *     const fn: typeof mapTsDiagnostic = mapTsDiagnostic;
 *     void fn;
 */
export function mapTsDiagnostic(diagnostic: ts.Diagnostic, sourcePath: string): CompileDiagnostic {
    const message = flattenDiagnosticMessage(diagnostic.messageText);
    const file = diagnostic.file;
    if (file === undefined || diagnostic.start === undefined) {
        return Object.freeze({
            severity: "error",
            code: "type-error",
            message: `TS${diagnostic.code}: ${message}`,
            file: sourcePath,
            line: 1,
            column: 1,
        });
    }
    const { line, character } = file.getLineAndCharacterOfPosition(diagnostic.start);
    return Object.freeze({
        severity: "error",
        code: "type-error",
        message: `TS${diagnostic.code}: ${message}`,
        file: sourcePath,
        line: line + 1,
        column: character + 1,
    });
}

function flattenDiagnosticMessage(message: string | ts.DiagnosticMessageChain): string {
    if (typeof message === "string") return message;
    const parts: string[] = [message.messageText];
    const next = message.next;
    if (next === undefined) return parts.join(" ");
    const queue: ReadonlyArray<ts.DiagnosticMessageChain> = next;
    for (const chain of queue) {
        parts.push(flattenDiagnosticMessage(chain));
    }
    return parts.join(" ");
}
