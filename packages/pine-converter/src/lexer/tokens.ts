// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Diagnostic, SourceSpan } from "../index.js";

/**
 * Lexical category of a {@link Token}. Synthetic `newline`/`indent`/
 * `dedent` tokens carry no source text of their own — they model Pine's
 * significant-indentation block scoping (similar to Python).
 *
 * @since 0.1
 * @experimental
 * @example
 *     const k: TokenKind = "identifier";
 *     void k;
 */
export type TokenKind =
    | "keyword"
    | "identifier"
    | "int"
    | "float"
    | "string"
    | "color"
    | "operator"
    | "punctuation"
    | "newline"
    | "indent"
    | "dedent"
    | "comment"
    | "version-directive"
    | "eof";

/**
 * A single lexed Pine token with a stable 1-based {@link SourceSpan}.
 * Optional fields are populated only for the kinds that define them.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const token: Token = {
 *         kind: "identifier",
 *         text: "close",
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 6 },
 *     };
 *     void token;
 */
export type Token = Readonly<{
    kind: TokenKind;
    text: string;
    span: SourceSpan;
    /** For `version-directive` only: the integer version. */
    versionNumber?: number;
    /** For `string` only: the unescaped value. */
    stringValue?: string;
    /** For `int`/`float`: the parsed number (NaN when `malformed`). */
    numericValue?: number;
    /** For malformed `int`/`float`: short-circuit sentinel for later passes. */
    malformed?: true;
}>;

/**
 * A lexer-stage diagnostic. Re-uses the package {@link Diagnostic} shape
 * so codes, severities, and spans stay uniform across every converter
 * stage; lexer codes are namespaced under `pine-converter/lex/...`.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const diag: LexerDiagnostic = {
 *         code: "pine-converter/lex/illegal-character",
 *         severity: "error",
 *         message: "unexpected character",
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
 *     };
 *     void diag;
 */
export type LexerDiagnostic = Diagnostic;

/**
 * Output of {@link lex}: the full token stream (always terminated by a
 * single `eof` token) plus any diagnostics gathered while scanning.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const result: LexResult = { tokens: [], diagnostics: [] };
 *     void result;
 */
export type LexResult = Readonly<{
    tokens: readonly Token[];
    diagnostics: readonly LexerDiagnostic[];
}>;
