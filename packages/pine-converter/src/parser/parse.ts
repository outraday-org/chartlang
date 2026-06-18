// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Script, Statement } from "../ast/index.js";
import type { Diagnostic } from "../index.js";
import type { Token } from "../lexer/index.js";
import { createContext } from "./context.js";
import { parseDeclaration, parseVersionDirective } from "./declarations.js";
import { spanBetween } from "./spans.js";
import { parseStatement } from "./statements.js";

/**
 * A parser-stage diagnostic. Re-uses the package {@link Diagnostic} shape so
 * codes, severities, and spans stay uniform across every converter stage;
 * parser codes are namespaced under `pine-converter/parse/...`.
 *
 * @since 0.1
 * @stable
 * @example
 *     const diag: ParserDiagnostic = {
 *         code: "pine-converter/parse/unexpected-token",
 *         severity: "error",
 *         message: "Unexpected token.",
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
 *     };
 *     void diag;
 */
export type ParserDiagnostic = Diagnostic;

/**
 * Output of {@link parseStatements}: the Pine v6 {@link Script} AST (always
 * returned, even on malformed input) plus any diagnostics gathered while
 * parsing.
 *
 * @since 0.1
 * @stable
 * @example
 *     const result: ParseResult = {
 *         script: {
 *             kind: "script",
 *             version: null,
 *             declaration: null,
 *             body: [],
 *             span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
 *         },
 *         diagnostics: [],
 *     };
 *     void result;
 */
export type ParseResult = Readonly<{
    script: Script;
    diagnostics: readonly ParserDiagnostic[];
}>;

/**
 * Parse a Pine v6 lexer token stream into a {@link Script} AST plus
 * diagnostics. The grammar is `VersionDirective? Declaration? Statement*`;
 * expression slots are filled with opaque `UnknownExpression` placeholders
 * by the Task 3 stub (Task 4 substitutes the real expression parser). The
 * parser never throws — every error becomes a diagnostic and parsing
 * continues past it.
 *
 * @since 0.1
 * @stable
 * @example
 *     const { script } = parseStatements(lex('//@version=6\nindicator("hi")\n').tokens);
 *     script.declaration?.kind; // "indicator-declaration"
 */
export function parseStatements(tokens: readonly Token[]): ParseResult {
    const ctx = createContext(tokens);
    const startSpan = ctx.cursor.peek().span;

    const version = parseVersionDirective(ctx);
    const declaration = parseDeclaration(ctx);

    const body: Statement[] = [];
    while (!ctx.cursor.atEnd()) {
        const statement = parseStatement(ctx);
        if (statement !== null) {
            body.push(statement);
        }
    }

    const endSpan = ctx.cursor.peek().span;
    const span = spanBetween(version?.span ?? startSpan, endSpan);
    const script: Script = {
        kind: "script",
        version,
        declaration,
        body,
        span,
    };
    return { script, diagnostics: ctx.diagnostics };
}
