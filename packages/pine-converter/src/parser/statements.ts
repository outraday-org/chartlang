// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    Assignment,
    BlockStatement,
    DeclarationQualifier,
    ElseIfClause,
    ForStatement,
    IfStatement,
    NamedTypeName,
    Statement,
    SwitchCase,
    SwitchStatement,
    TypeAnnotation,
    VariableDeclaration,
} from "../ast/index.js";
import { makeDiagnostic } from "../diagnostics/codes.js";
import type { Token, TokenKind } from "../lexer/index.js";
import type { ParserContext } from "./context.js";
import { parseExpression } from "./expressions.js";
import { spanBetween } from "./spans.js";

const STATEMENT_SYNC: ReadonlySet<TokenKind> = new Set<TokenKind>(["newline", "eof"]);

const NAMED_TYPES: ReadonlySet<NamedTypeName> = new Set<NamedTypeName>([
    "int",
    "float",
    "bool",
    "color",
    "string",
    "line",
    "label",
    "box",
    "table",
    "polyline",
    "linefill",
]);

function asNamedType(text: string): NamedTypeName | null {
    return (NAMED_TYPES as ReadonlySet<string>).has(text) ? (text as NamedTypeName) : null;
}

function recoverLine(ctx: ParserContext): void {
    ctx.cursor.recover(STATEMENT_SYNC);
    ctx.cursor.match("newline");
}

// Discard a rejected compound statement: its header line plus any indented
// body block, so the parser resumes cleanly at the next sibling statement
// (a balanced `indent`/`dedent` run, per the lexer's balance invariant).
function recoverCompound(ctx: ParserContext): void {
    recoverLine(ctx);
    if (ctx.cursor.peekKind() !== "indent") {
        return;
    }
    ctx.cursor.next();
    let depth = 1;
    while (depth > 0 && !ctx.cursor.atEnd()) {
        const kind = ctx.cursor.peekKind();
        if (kind === "indent") {
            depth += 1;
        } else if (kind === "dedent") {
            depth -= 1;
        }
        ctx.cursor.next();
    }
}

/**
 * Parse an indented block (`INDENT Statement+ DEDENT`). When the next token
 * is not an `indent` (an empty or malformed body) an `expected-token`
 * diagnostic is recorded and an empty block spanning the current token is
 * returned, so callers always receive a well-formed {@link BlockStatement}.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const ctx = createContext(lex("if c\n    x := 1\n").tokens);
 *     // after consuming `if c NEWLINE`, parseBlock reads the indented body
 *     void ctx;
 */
export function parseBlock(ctx: ParserContext): BlockStatement {
    const open = ctx.cursor.expect("indent");
    if (open === null) {
        const at = ctx.cursor.peek().span;
        ctx.addDiagnostic(makeDiagnostic("expected-token", at, "Expected an indented block."));
        return { kind: "block-statement", body: [], span: at };
    }
    const body: Statement[] = [];
    while (!ctx.cursor.atEnd() && ctx.cursor.peekKind() !== "dedent") {
        const statement = parseStatement(ctx);
        if (statement !== null) {
            body.push(statement);
        }
    }
    const close = ctx.cursor.expect("dedent");
    const endSpan = close === null ? ctx.cursor.peek().span : close.span;
    return { kind: "block-statement", body, span: spanBetween(open.span, endSpan) };
}

function parseTypeAnnotation(ctx: ParserContext): TypeAnnotation | null {
    const token = ctx.cursor.peek();
    if (token.kind !== "identifier") {
        return null;
    }
    const name = asNamedType(token.text);
    if (name === null) {
        return null;
    }
    // Only treat a leading type keyword as a type annotation when an
    // identifier follows it (`float x = ...`); otherwise it is the start of
    // an expression statement (`line.new(...)`).
    if (ctx.peekAhead(1).kind !== "identifier") {
        return null;
    }
    ctx.cursor.next();
    return { kind: "named-type", name, span: token.span };
}

function parseVariableDeclaration(
    ctx: ParserContext,
    qualifier: DeclarationQualifier,
    start: Token,
): VariableDeclaration {
    const typeAnnotation = parseTypeAnnotation(ctx);
    const nameToken = ctx.cursor.expect("identifier");
    const name = nameToken === null ? "" : nameToken.text;
    if (nameToken === null) {
        ctx.addDiagnostic(
            makeDiagnostic("expected-token", ctx.cursor.peek().span, "Expected a variable name."),
        );
    }
    ctx.cursor.match("operator", "=");
    const initializer = parseExpression(ctx);
    const end = ctx.cursor.peek().span;
    ctx.cursor.match("newline");
    return {
        kind: "variable-declaration",
        qualifier,
        typeAnnotation,
        name,
        initializer,
        span: spanBetween(start.span, end),
    };
}

function parseAssignment(
    ctx: ParserContext,
    nameToken: Token,
    operatorText: "=" | ":=",
): Assignment {
    ctx.cursor.next();
    ctx.cursor.next();
    const value = parseExpression(ctx);
    const end = ctx.cursor.peek().span;
    ctx.cursor.match("newline");
    return {
        kind: "assignment",
        operator: operatorText,
        name: nameToken.text,
        value,
        span: spanBetween(nameToken.span, end),
    };
}

function parseIfStatement(ctx: ParserContext, start: Token): IfStatement {
    ctx.cursor.next();
    const condition = parseExpression(ctx);
    ctx.cursor.match("newline");
    const thenBody = parseBlock(ctx);
    const elseIfClauses: ElseIfClause[] = [];
    let elseBody: BlockStatement | null = null;
    let endSpan = thenBody.span;
    while (ctx.cursor.peek().text === "else" && ctx.cursor.peekKind() === "keyword") {
        const elseToken = ctx.cursor.next();
        if (ctx.cursor.peek().text === "if" && ctx.cursor.peekKind() === "keyword") {
            ctx.cursor.next();
            const clauseCondition = parseExpression(ctx);
            ctx.cursor.match("newline");
            const clauseBody = parseBlock(ctx);
            elseIfClauses.push({
                condition: clauseCondition,
                body: clauseBody,
                span: spanBetween(elseToken.span, clauseBody.span),
            });
            endSpan = clauseBody.span;
            continue;
        }
        ctx.cursor.match("newline");
        elseBody = parseBlock(ctx);
        endSpan = elseBody.span;
        break;
    }
    return {
        kind: "if-statement",
        condition,
        thenBody,
        elseIfClauses,
        elseBody,
        span: spanBetween(start.span, endSpan),
    };
}

function parseForStatement(ctx: ParserContext, start: Token): Statement | null {
    ctx.cursor.next();
    const variable = ctx.cursor.expect("identifier");
    if (variable === null) {
        ctx.addDiagnostic(
            makeDiagnostic("expected-token", ctx.cursor.peek().span, "Expected a loop variable."),
        );
        recoverLine(ctx);
        return null;
    }
    if (ctx.cursor.peek().text === "in" && ctx.cursor.peekKind() === "keyword") {
        ctx.addDiagnostic(makeDiagnostic("unsupported-for-in", start.span));
        recoverCompound(ctx);
        return null;
    }
    ctx.cursor.match("operator", "=");
    const from = parseExpression(ctx);
    ctx.cursor.match("keyword", "to");
    const to = parseExpression(ctx);
    const step = ctx.cursor.match("keyword", "by") === null ? null : parseExpression(ctx);
    ctx.cursor.match("newline");
    const body = parseBlock(ctx);
    const forStatement: ForStatement = {
        kind: "for-statement",
        variable: variable.text,
        from,
        to,
        step,
        body,
        span: spanBetween(start.span, body.span),
    };
    return forStatement;
}

function parseSwitchStatement(ctx: ParserContext, start: Token): SwitchStatement {
    ctx.cursor.next();
    const subject = ctx.cursor.peekKind() === "newline" ? null : parseExpression(ctx);
    ctx.cursor.match("newline");
    const open = ctx.cursor.expect("indent");
    const cases: SwitchCase[] = [];
    let endSpan = open === null ? ctx.cursor.peek().span : open.span;
    if (open === null) {
        ctx.addDiagnostic(
            makeDiagnostic("expected-token", endSpan, "Expected an indented `switch` body."),
        );
        return { kind: "switch-statement", subject, cases, span: spanBetween(start.span, endSpan) };
    }
    while (!ctx.cursor.atEnd() && ctx.cursor.peekKind() !== "dedent") {
        const caseNode = parseSwitchCase(ctx);
        cases.push(caseNode);
        endSpan = caseNode.span;
    }
    const close = ctx.cursor.expect("dedent");
    if (close !== null) {
        endSpan = close.span;
    }
    return { kind: "switch-statement", subject, cases, span: spanBetween(start.span, endSpan) };
}

function parseSwitchCase(ctx: ParserContext): SwitchCase {
    const startToken = ctx.cursor.peek();
    const test = ctx.cursor.peek().text === "=>" ? null : parseExpression(ctx);
    ctx.cursor.match("operator", "=>");
    ctx.cursor.match("newline");
    const body: Statement[] = [];
    let endSpan = startToken.span;
    if (ctx.cursor.peekKind() === "indent") {
        const block = parseBlock(ctx);
        for (const statement of block.body) {
            body.push(statement);
        }
        endSpan = block.span;
    } else {
        const statement = parseStatement(ctx);
        if (statement !== null) {
            body.push(statement);
            endSpan = statement.span;
        }
    }
    return { test, body, span: spanBetween(startToken.span, endSpan) };
}

function parseSimpleStatement(
    ctx: ParserContext,
    start: Token,
    kind: "break-statement" | "continue-statement",
): Statement {
    ctx.cursor.next();
    const end = ctx.cursor.peek().span;
    ctx.cursor.match("newline");
    return { kind, span: spanBetween(start.span, end) };
}

function parseReturnStatement(ctx: ParserContext, start: Token): Statement {
    ctx.cursor.next();
    const value = ctx.cursor.peekKind() === "newline" ? null : parseExpression(ctx);
    const end = ctx.cursor.peek().span;
    ctx.cursor.match("newline");
    return { kind: "return-statement", value, span: spanBetween(start.span, end) };
}

function parseKeywordStatement(ctx: ParserContext, start: Token): Statement | null {
    switch (start.text) {
        case "var":
        case "varip": {
            ctx.cursor.next();
            return parseVariableDeclaration(ctx, start.text, start);
        }
        case "if":
            return parseIfStatement(ctx, start);
        case "for":
            return parseForStatement(ctx, start);
        case "switch":
            return parseSwitchStatement(ctx, start);
        case "break":
            return parseSimpleStatement(ctx, start, "break-statement");
        case "continue":
            return parseSimpleStatement(ctx, start, "continue-statement");
        case "return":
            return parseReturnStatement(ctx, start);
        case "while":
            ctx.addDiagnostic(makeDiagnostic("unsupported-while", start.span));
            recoverCompound(ctx);
            return null;
        case "type":
            ctx.addDiagnostic(makeDiagnostic("unsupported-udt", start.span));
            recoverCompound(ctx);
            return null;
        case "method":
            ctx.addDiagnostic(makeDiagnostic("unsupported-method", start.span));
            recoverCompound(ctx);
            return null;
        case "import":
            ctx.addDiagnostic(makeDiagnostic("unsupported-library-import", start.span));
            recoverLine(ctx);
            return null;
        default:
            ctx.addDiagnostic(
                makeDiagnostic(
                    "unexpected-token",
                    start.span,
                    `Unexpected keyword \`${start.text}\`.`,
                ),
            );
            recoverLine(ctx);
            return null;
    }
}

function parseIdentifierStatement(ctx: ParserContext, start: Token): Statement {
    // A bare type keyword followed by an identifier is a typed declaration
    // (`float x = ...`); otherwise the leading identifier may be an
    // assignment target or the head of an expression statement.
    if (asNamedType(start.text) !== null && ctx.peekAhead(1).kind === "identifier") {
        return parseVariableDeclaration(ctx, "none", start);
    }
    const after = ctx.peekAhead(1);
    if (after.kind === "operator" && (after.text === ":=" || after.text === "=")) {
        return parseAssignment(ctx, start, after.text);
    }
    const expression = parseExpression(ctx);
    const end = ctx.cursor.peek().span;
    ctx.cursor.match("newline");
    return { kind: "expression-statement", expression, span: spanBetween(start.span, end) };
}

/**
 * Parse a single statement. Returns `null` when the statement was rejected
 * or recovered from (a diagnostic was recorded) so the caller skips a null
 * body entry; the parser never throws.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const ctx = createContext(lex("x := 1\n").tokens);
 *     parseStatement(ctx)?.kind; // "assignment"
 */
export function parseStatement(ctx: ParserContext): Statement | null {
    const start = ctx.cursor.peek();
    if (ctx.cursor.peekKind() === "newline") {
        ctx.cursor.next();
        return null;
    }
    if (start.kind === "keyword") {
        return parseKeywordStatement(ctx, start);
    }
    if (start.kind === "identifier") {
        return parseIdentifierStatement(ctx, start);
    }
    const expression = parseExpression(ctx);
    if (expression.kind === "unknown-expression" && expression.tokens.length === 0) {
        ctx.addDiagnostic(
            makeDiagnostic("unexpected-token", start.span, `Unexpected token \`${start.text}\`.`),
        );
        recoverLine(ctx);
        return null;
    }
    const end = ctx.cursor.peek().span;
    ctx.cursor.match("newline");
    return { kind: "expression-statement", expression, span: spanBetween(start.span, end) };
}
