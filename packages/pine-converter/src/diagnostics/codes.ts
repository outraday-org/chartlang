// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Diagnostic, DiagnosticSeverity, SourceSpan } from "../index.js";

/**
 * A single entry in the converter's diagnostic-code registry: the stable
 * `code`, its default `severity`, the advisory `defaultMessage`, and an
 * optional `defaultSuggestion` describing the manual rewrite.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const entry: DiagnosticCodeEntry = {
 *         code: "pine-converter/parse/unexpected-token",
 *         severity: "error",
 *         defaultMessage: "Unexpected token.",
 *     };
 *     void entry;
 */
export type DiagnosticCodeEntry = Readonly<{
    code: string;
    severity: DiagnosticSeverity;
    defaultMessage: string;
    defaultSuggestion?: string;
}>;

/**
 * Single-source registry of the parser-stage diagnostic codes. Every code
 * is namespaced `pine-converter/parse/...` so it never collides with a
 * lexer code (`pine-converter/lex/...`). Add a code here, never inline a
 * literal in the parser.
 *
 * @since 0.1
 * @experimental
 * @example
 *     DIAGNOSTIC_CODES["unsupported-strategy"].severity; // "error"
 */
export const DIAGNOSTIC_CODES = {
    "unsupported-pine-version": {
        code: "pine-converter/parse/unsupported-pine-version",
        severity: "error",
        defaultMessage: "Only Pine Script v6 is supported.",
        defaultSuggestion: "Change the directive to `//@version=6`.",
    },
    "missing-version-directive": {
        code: "pine-converter/parse/missing-version-directive",
        severity: "error",
        defaultMessage: "Script must start with a `//@version=6` directive.",
        defaultSuggestion: "Add `//@version=6` as the first line.",
    },
    "unsupported-strategy": {
        code: "pine-converter/parse/unsupported-strategy",
        severity: "error",
        defaultMessage: "`strategy(...)` declarations are not supported.",
        defaultSuggestion:
            "Strip the backtester and convert the signal logic as an `indicator(...)`.",
    },
    "unsupported-library": {
        code: "pine-converter/parse/unsupported-library",
        severity: "error",
        defaultMessage: "`library(...)` declarations are not supported.",
        defaultSuggestion: "Inline the exported functions into an `indicator(...)` script.",
    },
    "unsupported-for-in": {
        code: "pine-converter/parse/unsupported-for-in",
        severity: "error",
        defaultMessage: "`for ... in` loops are not supported.",
        defaultSuggestion: "Rewrite as a literal-bounded `for i = a to b` loop.",
    },
    "unsupported-while": {
        code: "pine-converter/parse/unsupported-while",
        severity: "error",
        defaultMessage: "`while` loops are not supported.",
        defaultSuggestion: "Rewrite as a literal-bounded `for i = a to b` loop.",
    },
    "expected-token": {
        code: "pine-converter/parse/expected-token",
        severity: "error",
        defaultMessage: "Expected a different token here.",
    },
    "unexpected-token": {
        code: "pine-converter/parse/unexpected-token",
        severity: "error",
        defaultMessage: "Unexpected token.",
    },
} as const satisfies Record<string, DiagnosticCodeEntry>;

/**
 * The set of parser-stage diagnostic-code keys.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const key: ParserDiagnosticCode = "unsupported-strategy";
 *     void key;
 */
export type ParserDiagnosticCode = keyof typeof DIAGNOSTIC_CODES;

/**
 * Build a {@link Diagnostic} from a registry key, a {@link SourceSpan}, and
 * an optional message override (used to inject the specific token text into
 * a generic `expected-token`/`unexpected-token` message). The severity,
 * stable code string, and default suggestion come from the registry.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const diag = makeDiagnostic("unsupported-strategy", {
 *         startLine: 2,
 *         startColumn: 1,
 *         endLine: 2,
 *         endColumn: 15,
 *     });
 *     diag.code; // "pine-converter/parse/unsupported-strategy"
 */
export function makeDiagnostic(
    key: ParserDiagnosticCode,
    span: SourceSpan,
    messageOverride?: string,
): Diagnostic {
    const entry: DiagnosticCodeEntry = DIAGNOSTIC_CODES[key];
    const base = {
        code: entry.code,
        severity: entry.severity,
        message: messageOverride ?? entry.defaultMessage,
        span,
    };
    return entry.defaultSuggestion === undefined
        ? base
        : { ...base, suggestion: entry.defaultSuggestion };
}
