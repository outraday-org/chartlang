// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    CallArgument,
    CallExpression,
    ExpressionNode,
    IdentifierExpression,
    LiteralExpression,
    LiteralKind,
    MemberAccessExpression,
    TernaryExpression,
    UnaryExpression,
} from "../ast/index.js";
import { makeDiagnostic } from "../diagnostics/codes.js";
import type { Token } from "../lexer/index.js";
import type { ParserContext } from "./context.js";
import { spanBetween } from "./spans.js";
import { parseSwitchExpression } from "./statements.js";

// Binary-operator precedence (higher binds tighter). `and`/`or` are
// `keyword` tokens; the comparison/arithmetic operators are `operator`
// tokens — the table keys on text alone because no operator text overlaps a
// keyword. Source: TradingView Pine v6 operator-precedence reference.
const BINARY_PRECEDENCE: ReadonlyMap<string, number> = new Map([
    ["or", 1],
    ["and", 2],
    ["==", 3],
    ["!=", 3],
    ["<", 4],
    ["<=", 4],
    [">", 4],
    [">=", 4],
    ["+", 5],
    ["-", 5],
    ["*", 6],
    ["/", 6],
    ["%", 6],
]);

const LITERAL_TOKEN_KINDS: ReadonlyMap<Token["kind"], LiteralKind> = new Map([
    ["int", "int"],
    ["float", "float"],
    ["string", "string"],
    ["color", "color"],
]);

const LEAVE_IN_PLACE_PUNCTUATION: ReadonlySet<string> = new Set([")", "]", "}", ","]);

// Tokens that cannot start an expression and must NOT be consumed by the
// prefix parser, so the caller's empty-expression recovery can act on them.
function isLeaveInPlaceBoundary(token: Token): boolean {
    if (token.kind === "newline" || token.kind === "dedent" || token.kind === "eof") {
        return true;
    }
    return token.kind === "punctuation" && LEAVE_IN_PLACE_PUNCTUATION.has(token.text);
}

// The binding precedence of `token` as a binary operator, or `null` when it
// is not one. `and`/`or` are keywords; the rest are operators — both live in
// the same precedence table, so one lookup decides membership and strength.
function binaryPrecedenceOf(token: Token): number | null {
    if (token.kind === "operator" || token.kind === "keyword") {
        return BINARY_PRECEDENCE.get(token.text) ?? null;
    }
    return null;
}

function isOperatorToken(token: Token, text: string): boolean {
    return token.kind === "operator" && token.text === text;
}

function isPunctuationToken(token: Token, text: string): boolean {
    return token.kind === "punctuation" && token.text === text;
}

/**
 * Scan a Pine v6 generic type-argument list `< Type (, Type)* >` (each
 * `Type` an `ident` with an optional dotted `.member` chain), starting at
 * `peekAhead(startOffset)` which must be the opening `<`. Returns the number
 * of tokens spanned (the `<` through the closing `>`, inclusive) and the last
 * element type name (the value type for `map<K, V>`), or `null` when the
 * lookahead is not a well-formed type-argument list. Lookahead only — it
 * never consumes. Used both for the `array.new<line>()` constructor (the type
 * arg is discarded) and the `array<line> x` / `map<…> x` variable-type
 * annotation (the element type becomes the declared type).
 *
 * @since 0.1
 * @stable
 * @example
 *     // declare const ctx: import("./context.js").ParserContext; // at `array.new<line>(`
 *     // scanTypeArgs(ctx, 2); // { count: 3, lastType: "line" } for `<line>`
 */
export function scanTypeArgs(
    ctx: ParserContext,
    startOffset: number,
): { readonly count: number; readonly lastType: string | null } | null {
    if (!isOperatorToken(ctx.peekAhead(startOffset), "<")) {
        return null;
    }
    let offset = startOffset + 1;
    let lastType: string | null = null;
    for (;;) {
        const typeToken = ctx.peekAhead(offset);
        if (typeToken.kind !== "identifier") {
            return null;
        }
        lastType = typeToken.text;
        offset += 1;
        while (isPunctuationToken(ctx.peekAhead(offset), ".")) {
            offset += 1;
            const member = ctx.peekAhead(offset);
            if (member.kind !== "identifier") {
                return null;
            }
            lastType = member.text;
            offset += 1;
        }
        const separator = ctx.peekAhead(offset);
        if (isOperatorToken(separator, ">")) {
            return { count: offset - startOffset + 1, lastType };
        }
        if (isPunctuationToken(separator, ",")) {
            offset += 1;
            continue;
        }
        return null;
    }
}

function literalFrom(token: Token, literalKind: LiteralKind): LiteralExpression {
    return { kind: "literal-expression", literalKind, value: token.text, span: token.span };
}

function identifierFrom(token: Token): IdentifierExpression {
    return { kind: "identifier-expression", name: token.text, span: token.span };
}

// Parse the `( ... )` that opens either a paren group, a tuple, or a lambda
// parameter list. The arrow `=>` immediately after the closing paren makes
// it a lambda; one element makes a paren; two or more make a tuple.
function parseParenOrTupleOrLambda(ctx: ParserContext, open: Token): ExpressionNode {
    const elements: ExpressionNode[] = [];
    if (ctx.cursor.peek().text !== ")") {
        do {
            elements.push(parseExpression(ctx));
        } while (ctx.cursor.match("punctuation", ",") !== null);
    }
    const close = ctx.cursor.expect("punctuation", ")");
    const endSpan = close === null ? ctx.cursor.peek().span : close.span;
    if (close === null) {
        ctx.addDiagnostic(makeDiagnostic("expected-token", endSpan, "Expected `)`."));
    }
    const span = spanBetween(open.span, endSpan);
    const arrow = ctx.cursor.peek();
    if (arrow.kind === "operator" && arrow.text === "=>") {
        ctx.cursor.next();
        const body = parseExpression(ctx);
        const params = elements.map((element) =>
            element.kind === "identifier-expression" ? element.name : "",
        );
        return {
            kind: "lambda-expression",
            params,
            body,
            span: spanBetween(open.span, body.span),
        };
    }
    if (elements.length === 1) {
        return { kind: "paren-expression", expression: elements[0], span };
    }
    return { kind: "tuple-expression", elements, span };
}

// Parse a value-position array literal `[a, b, c]` (empty `[]` and a trailing
// comma allowed). This is the PREFIX `[` — a `[` with no left operand, reached
// only from `parsePrimary` (statement value start, or after `=`/`(`/`,`/an
// operator). A postfix `[` (a receiver is present, e.g. `a[0]`) is the
// precedence-9 history access in `parsePostfix`; a statement-leading
// `[ ident… ] =` is the tuple destructuring in `statements.ts` — both untouched.
function parseArrayLiteral(ctx: ParserContext, open: Token): ExpressionNode {
    const elements: ExpressionNode[] = [];
    while (ctx.cursor.peek().text !== "]") {
        elements.push(parseExpression(ctx));
        if (ctx.cursor.match("punctuation", ",") === null) {
            break;
        }
    }
    const close = ctx.cursor.match("punctuation", "]");
    if (close === null) {
        // Unterminated `[` — leave the boundary token in place (do not consume
        // to EOF) and return a zero-width fallback at the `[`, so the statement
        // layer's empty-expression recovery resumes. The parser never throws.
        const at = open.span;
        return {
            kind: "unknown-expression",
            tokens: [],
            span: { ...at, endColumn: at.startColumn, endLine: at.startLine },
        };
    }
    return {
        kind: "array-literal-expression",
        elements,
        span: spanBetween(open.span, close.span),
    };
}

function parsePrimary(ctx: ParserContext): ExpressionNode {
    const token = ctx.cursor.peek();
    const literalKind = LITERAL_TOKEN_KINDS.get(token.kind);
    if (literalKind !== undefined) {
        ctx.cursor.next();
        return literalFrom(token, literalKind);
    }
    if (token.kind === "keyword") {
        if (token.text === "na") {
            ctx.cursor.next();
            return { kind: "na-expression", span: token.span };
        }
        if (token.text === "true" || token.text === "false") {
            ctx.cursor.next();
            return literalFrom(token, "bool");
        }
        // A `switch` in value position (`x = switch s …`) is the prefix form of
        // the statement-form switch; delegate to the shared arm parser.
        if (token.text === "switch") {
            return parseSwitchExpression(ctx);
        }
    }
    if (token.kind === "identifier") {
        ctx.cursor.next();
        return identifierFrom(token);
    }
    if (token.kind === "punctuation" && token.text === "(") {
        ctx.cursor.next();
        return parseParenOrTupleOrLambda(ctx, token);
    }
    if (token.kind === "punctuation" && token.text === "[") {
        ctx.cursor.next();
        return parseArrayLiteral(ctx, token);
    }
    // No prefix rule can start here. Leave a closing/separator boundary
    // (`) ] } ,`, newline, eof) in place — emitting a zero-token, zero-width
    // node — so the caller's empty-expression check recovers without
    // swallowing the token; any other stray token is captured into the span.
    if (isLeaveInPlaceBoundary(token)) {
        const at = token.span;
        return {
            kind: "unknown-expression",
            tokens: [],
            span: { ...at, endColumn: at.startColumn, endLine: at.startLine },
        };
    }
    ctx.cursor.next();
    return { kind: "unknown-expression", tokens: [token], span: token.span };
}

function parseCallArguments(ctx: ParserContext): readonly CallArgument[] {
    const args: CallArgument[] = [];
    if (ctx.cursor.peek().text === ")") {
        return args;
    }
    let sawNamed = false;
    do {
        const nameToken = parseArgumentName(ctx);
        const value = parseExpression(ctx);
        if (nameToken !== null) {
            sawNamed = true;
            args.push({
                name: nameToken.text,
                value,
                span: spanBetween(nameToken.span, value.span),
            });
            continue;
        }
        if (sawNamed) {
            ctx.addDiagnostic(makeDiagnostic("mixed-named-positional-args", value.span));
        }
        args.push({ name: null, value, span: value.span });
    } while (ctx.cursor.match("punctuation", ",") !== null);
    return args;
}

function parseArgumentName(ctx: ParserContext): Token | null {
    const token = ctx.cursor.peek();
    const after = ctx.peekAhead(1);
    if (token.kind === "identifier" && after.kind === "operator" && after.text === "=") {
        ctx.cursor.next();
        ctx.cursor.next();
        return token;
    }
    return null;
}

// Apply the precedence-9 postfix operators (call `(`, history `[`, member
// `.`) left-associatively to `receiver`.
function parsePostfix(ctx: ParserContext, receiver: ExpressionNode): ExpressionNode {
    let node = receiver;
    for (;;) {
        const token = ctx.cursor.peek();
        if (token.kind === "punctuation" && token.text === ".") {
            node = parseMemberAccess(ctx, node);
            continue;
        }
        if (token.kind === "punctuation" && token.text === "(") {
            node = parseCall(ctx, node);
            continue;
        }
        if (token.kind === "punctuation" && token.text === "[") {
            node = parseHistoryAccess(ctx, node);
            continue;
        }
        // Generic constructor type args: `array.new<line>()` /
        // `map.new<string, float>()`. The `<…>` is consumed and discarded
        // (the call's element type is recovered elsewhere from the push site);
        // restricting to a `.new` member chain keeps a real `a.b < c`
        // comparison from being mis-read as a type-argument list.
        if (isGenericConstructorArgs(ctx, node)) {
            const args = scanTypeArgs(ctx, 0);
            if (args !== null) {
                for (let i = 0; i < args.count; i += 1) {
                    ctx.cursor.next();
                }
                continue;
            }
        }
        return node;
    }
}

// Whether the current `<` opens a generic-constructor type-argument list on a
// `.new` member receiver (`array.new<line>(`) — a type-arg list followed by a
// call `(`. Pure lookahead.
function isGenericConstructorArgs(ctx: ParserContext, node: ExpressionNode): boolean {
    if (!isOperatorToken(ctx.cursor.peek(), "<")) {
        return false;
    }
    if (node.kind !== "member-access-expression") {
        return false;
    }
    if (node.chain[node.chain.length - 1] !== "new") {
        return false;
    }
    const args = scanTypeArgs(ctx, 0);
    return args !== null && isPunctuationToken(ctx.peekAhead(args.count), "(");
}

// Consume a single `.member` and extend `receiver`. When the receiver is a
// bare identifier (or an existing chain rooted at one) the names flatten into
// `chain` with `head: null`; a computed receiver becomes the `head`. The
// precedence-9 postfix loop re-enters this for each subsequent `.`.
function parseMemberAccess(ctx: ParserContext, receiver: ExpressionNode): MemberAccessExpression {
    const chain: string[] = [];
    let head: ExpressionNode | null = receiver;
    if (receiver.kind === "identifier-expression") {
        chain.push(receiver.name);
        head = null;
    } else if (receiver.kind === "member-access-expression") {
        chain.push(...receiver.chain);
        head = receiver.head;
    }
    ctx.cursor.next();
    const nameToken = ctx.cursor.expect("identifier");
    if (nameToken === null) {
        const at = ctx.cursor.peek().span;
        ctx.addDiagnostic(makeDiagnostic("expected-token", at, "Expected a member name."));
        return { kind: "member-access-expression", head, chain, span: receiver.span };
    }
    chain.push(nameToken.text);
    return {
        kind: "member-access-expression",
        head,
        chain,
        span: spanBetween(receiver.span, nameToken.span),
    };
}

function parseCall(ctx: ParserContext, callee: ExpressionNode): CallExpression {
    ctx.cursor.next();
    const args = parseCallArguments(ctx);
    const close = ctx.cursor.expect("punctuation", ")");
    const endSpan = close === null ? ctx.cursor.peek().span : close.span;
    if (close === null) {
        ctx.addDiagnostic(makeDiagnostic("expected-token", endSpan, "Expected `)` to close call."));
    }
    return { kind: "call-expression", callee, args, span: spanBetween(callee.span, endSpan) };
}

function parseHistoryAccess(ctx: ParserContext, receiver: ExpressionNode): ExpressionNode {
    ctx.cursor.next();
    const offset = parseExpression(ctx);
    const close = ctx.cursor.expect("punctuation", "]");
    const endSpan = close === null ? ctx.cursor.peek().span : close.span;
    if (close === null) {
        ctx.addDiagnostic(makeDiagnostic("expected-token", endSpan, "Expected `]`."));
    }
    return {
        kind: "history-access-expression",
        receiver,
        offset,
        span: spanBetween(receiver.span, endSpan),
    };
}

function parsePrefix(ctx: ParserContext): ExpressionNode {
    const token = ctx.cursor.peek();
    const isMinus = token.kind === "operator" && (token.text === "+" || token.text === "-");
    const isNot = token.kind === "keyword" && token.text === "not";
    if (isMinus || isNot) {
        ctx.cursor.next();
        const operand = parsePrefix(ctx);
        const node: UnaryExpression = {
            kind: "unary-expression",
            operator: token.text === "+" ? "+" : token.text === "-" ? "-" : "not",
            operand,
            span: spanBetween(token.span, operand.span),
        };
        return node;
    }
    return parsePostfix(ctx, parsePrimary(ctx));
}

function parseBinary(ctx: ParserContext, minPrecedence: number): ExpressionNode {
    let left = parsePrefix(ctx);
    for (;;) {
        const token = ctx.cursor.peek();
        const precedence = binaryPrecedenceOf(token);
        if (precedence === null || precedence < minPrecedence) {
            return left;
        }
        ctx.cursor.next();
        // Left-associative: the right operand binds operators strictly
        // tighter than this one.
        const right = parseBinary(ctx, precedence + 1);
        left = {
            kind: "binary-expression",
            operator: token.text,
            left,
            right,
            span: spanBetween(left.span, right.span),
        };
    }
}

function parseTernary(ctx: ParserContext): ExpressionNode {
    const condition = parseBinary(ctx, 1);
    const question = ctx.cursor.peek();
    if (question.kind !== "operator" || question.text !== "?") {
        return condition;
    }
    ctx.cursor.next();
    const consequent = parseTernary(ctx);
    ctx.cursor.match("operator", ":");
    const alternate = parseTernary(ctx);
    if (alternate.kind === "ternary-expression") {
        ctx.addDiagnostic(makeDiagnostic("chained-ternary-warning", alternate.span));
    }
    const node: TernaryExpression = {
        kind: "ternary-expression",
        condition,
        consequent,
        alternate,
        span: spanBetween(condition.span, alternate.span),
    };
    return node;
}

/**
 * Parse a Pine v6 expression with full operator precedence: ternary (`?:`,
 * lowest), `or`, `and`, equality, relational, additive, multiplicative,
 * prefix unary (`+`/`-`/`not`), then the precedence-9 postfix operators —
 * call `(...)`, history `[n]`, and member `.` access. Identifiers,
 * literals, `na`, booleans, parenthesized groups, tuples, and lambdas are
 * the primary forms. The parser never throws — an unstartable position
 * yields an {@link UnknownExpression} and a diagnostic is recorded by the
 * caller. This is the Task 4 replacement for the Task 3 stub; every
 * `Expression` slot routes through it.
 *
 * @since 0.1
 * @stable
 * @example
 *     const ctx = createContext(lex("ta.ema(close, 9)[3]\n").tokens);
 *     const expr = parseExpression(ctx);
 *     expr.kind; // "history-access-expression"
 */
export function parseExpression(ctx: ParserContext): ExpressionNode {
    return parseTernary(ctx);
}
