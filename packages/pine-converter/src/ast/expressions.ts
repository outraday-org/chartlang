// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Token } from "../lexer/index.js";
import type { WithSpan } from "./spans.js";

/**
 * An identifier reference (`close`, `myVar`, `line`). The qualified-name
 * resolution (built-in vs local) happens later in semantic analysis.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const e: IdentifierExpression = {
 *         kind: "identifier-expression",
 *         name: "close",
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 6 },
 *     };
 *     void e;
 */
export type IdentifierExpression = WithSpan &
    Readonly<{
        kind: "identifier-expression";
        name: string;
    }>;

/**
 * Lexical category of a {@link LiteralExpression} value.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const t: LiteralKind = "int";
 *     void t;
 */
export type LiteralKind = "int" | "float" | "string" | "color" | "bool" | "na";

/**
 * A literal value (`42`, `1.5`, `"hi"`, `#ff0000`, `true`, `na`). `value`
 * is the source text; typed views (`numericValue`, `stringValue`) come off
 * the originating {@link Token} during later passes.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const e: LiteralExpression = {
 *         kind: "literal-expression",
 *         literalKind: "int",
 *         value: "42",
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 3 },
 *     };
 *     void e;
 */
export type LiteralExpression = WithSpan &
    Readonly<{
        kind: "literal-expression";
        literalKind: LiteralKind;
        value: string;
    }>;

/**
 * Opaque expression placeholder produced by the Task 3 stub parser. It
 * captures the raw {@link Token}s up to the next statement boundary so
 * top-level structure can be asserted before Task 4's real expression
 * parser replaces it.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const e: UnknownExpression = {
 *         kind: "unknown-expression",
 *         tokens: [],
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
 *     };
 *     void e;
 */
export type UnknownExpression = WithSpan &
    Readonly<{
        kind: "unknown-expression";
        tokens: readonly Token[];
    }>;

/**
 * Any Pine expression node. Task 3 only produces identifiers, literals,
 * and {@link UnknownExpression} placeholders; Task 4 expands the union
 * with the full operator/call grammar.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const e: ExpressionNode = {
 *         kind: "identifier-expression",
 *         name: "open",
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 5 },
 *     };
 *     void e;
 */
export type ExpressionNode = IdentifierExpression | LiteralExpression | UnknownExpression;
