// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CompileDiagnostic } from "@invinite-org/chartlang-compiler";

import type { LspDiagnostic, LspSeverity } from "../types";

/**
 * Map a compiler diagnostic into the language-service diagnostic shape.
 *
 * @since 0.4
 * @stable
 * @example
 *     const diagnostic = mapDiagnostic({
 *         severity: "error",
 *         code: "unbounded-loop",
 *         message: "while loops are not allowed",
 *         file: "demo.chart.ts",
 *         line: 1,
 *         column: 1,
 *     });
 *     void diagnostic;
 */
export function mapDiagnostic(diagnostic: CompileDiagnostic): LspDiagnostic {
    const related =
        diagnostic.nodeText === undefined ? {} : { relatedCallsite: diagnostic.nodeText };
    return makeDiagnostic({
        line: diagnostic.line,
        column: diagnostic.column,
        severity: diagnostic.severity,
        code: diagnostic.code,
        message: diagnostic.message,
        ...related,
    });
}

/**
 * Build a language-service diagnostic at a 1-based line/column position.
 *
 * @since 0.4
 * @experimental
 * @example
 *     const diagnostic = makeDiagnostic({
 *         line: 1,
 *         column: 1,
 *         severity: "hint",
 *         code: "unsupported-interval",
 *         message: "Unsupported interval",
 *     });
 *     void diagnostic;
 */
export function makeDiagnostic(args: {
    readonly line: number;
    readonly column: number;
    readonly severity: LspSeverity;
    readonly code: string;
    readonly message: string;
    readonly relatedCallsite?: string;
}): LspDiagnostic {
    const related =
        args.relatedCallsite === undefined ? {} : { relatedCallsite: args.relatedCallsite };
    return Object.freeze({
        range: Object.freeze({
            startLine: args.line,
            startColumn: args.column,
            endLine: args.line,
            endColumn: args.column,
        }),
        severity: args.severity,
        code: args.code,
        message: args.message,
        ...related,
    });
}
