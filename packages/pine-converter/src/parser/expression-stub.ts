// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ExpressionNode, UnknownExpression } from "../ast/index.js";
import type { Token, TokenKind } from "../lexer/index.js";
import type { ParserContext } from "./context.js";
import { spanBetween } from "./spans.js";

// Tokens that close an expression context. Task 4 replaces this stub with a
// real Pratt parser; until then we capture the run of tokens up to the next
// boundary so top-level structure can be asserted end-to-end.
const BOUNDARY_KINDS: ReadonlySet<TokenKind> = new Set<TokenKind>([
    "newline",
    "indent",
    "dedent",
    "eof",
]);

const BOUNDARY_OPERATORS: ReadonlySet<string> = new Set(["=>"]);
const BOUNDARY_KEYWORDS: ReadonlySet<string> = new Set(["to", "by"]);
const BOUNDARY_PUNCTUATION: ReadonlySet<string> = new Set([",", ")", "]", "}"]);
const OPEN_BRACKETS: ReadonlySet<string> = new Set(["(", "[", "{"]);
const CLOSE_BRACKETS: ReadonlySet<string> = new Set([")", "]", "}"]);

// `depth` tracks nesting inside `( [ {` so a `,` / `) ] }` belonging to a
// nested call or subscript does not prematurely close the expression — only
// a depth-0 boundary token ends it (`plot(a, b)` captures as one node).
function isBoundary(token: Token, depth: number): boolean {
    if (BOUNDARY_KINDS.has(token.kind)) {
        return true;
    }
    if (token.kind === "operator") {
        return BOUNDARY_OPERATORS.has(token.text);
    }
    if (token.kind === "keyword") {
        return BOUNDARY_KEYWORDS.has(token.text);
    }
    if (token.kind === "punctuation") {
        return depth === 0 && BOUNDARY_PUNCTUATION.has(token.text);
    }
    return false;
}

/**
 * Task 3 expression-parser stub. Captures every token from the cursor's
 * current position up to (but not consuming) the next depth-0 expression
 * boundary — a `newline`/`indent`/`dedent`/`eof`, a `,`/`)`/`]`/`}`, the `=>`
 * operator, or a `to`/`by` keyword — tracking `( [ {` nesting so commas and
 * closers inside a nested call/subscript stay part of the run. The captured
 * tokens are packaged into an {@link UnknownExpression}. When no tokens
 * precede the boundary the node is still returned with a zero-width span at
 * the boundary token, so callers always receive a well-formed
 * {@link ExpressionNode}. Task 4 swaps this one module for the real
 * expression grammar.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const ctx = createContext(lex("close + 1\n").tokens);
 *     const expr = parseExpression(ctx);
 *     expr.kind; // "unknown-expression"
 */
export function parseExpression(ctx: ParserContext): ExpressionNode {
    const tokens: Token[] = [];
    let depth = 0;
    while (!isBoundary(ctx.cursor.peek(), depth)) {
        const token = ctx.cursor.next();
        if (token.kind === "punctuation") {
            if (OPEN_BRACKETS.has(token.text)) {
                depth += 1;
            } else if (depth > 0 && CLOSE_BRACKETS.has(token.text)) {
                depth -= 1;
            }
        }
        tokens.push(token);
    }
    const first = tokens[0];
    if (first === undefined) {
        const at = ctx.cursor.peek().span;
        return {
            kind: "unknown-expression",
            tokens,
            span: { ...at, endColumn: at.startColumn, endLine: at.startLine },
        };
    }
    const last = tokens[tokens.length - 1];
    return {
        kind: "unknown-expression",
        tokens,
        span: spanBetween(first.span, last.span),
    };
}
