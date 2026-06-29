// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    Assignment,
    AssignmentOperator,
    BlockStatement,
    DeclarationQualifier,
    ElseIfClause,
    ExpressionNode,
    ExpressionStatement,
    ForStatement,
    FunctionDeclaration,
    FunctionParam,
    IfStatement,
    NamedTypeName,
    Statement,
    SwitchCase,
    SwitchExpression,
    SwitchExpressionCase,
    SwitchStatement,
    TupleDeclaration,
    TupleTarget,
    TypeAnnotation,
    VariableDeclaration,
} from "../ast/index.js";
import { makeDiagnostic } from "../diagnostics/codes.js";
import type { SourceSpan } from "../index.js";
import type { Token, TokenKind } from "../lexer/index.js";
import type { ParserContext } from "./context.js";
import { parseExpression, scanTypeArgs } from "./expressions.js";
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

// Pine v6 generic container type roots. `array<line>` / `matrix<float>` /
// `map<string, float>` annotate a variable with an element type; the last
// type argument carries the element kind a drawing collection is keyed on.
const CONTAINER_TYPE_NAMES: ReadonlySet<string> = new Set(["array", "matrix", "map"]);

// Whether `peekAhead(1..3)` is the `[] <name>` array-type suffix of a scalar
// named type (`line[] pivots`).
function hasArrayTypeSuffix(ctx: ParserContext): boolean {
    return (
        ctx.peekAhead(1).kind === "punctuation" &&
        ctx.peekAhead(1).text === "[" &&
        ctx.peekAhead(2).kind === "punctuation" &&
        ctx.peekAhead(2).text === "]" &&
        ctx.peekAhead(3).kind === "identifier"
    );
}

// The element {@link NamedTypeName} of a `array<…>` / `map<…>` container type
// at the cursor (`<` at `peekAhead(1)`) plus the token span to consume before
// the variable name, or `null` when it is not a well-formed container-typed
// declaration (`container <args> <name>`).
function containerTypeAnnotation(
    ctx: ParserContext,
): { readonly name: NamedTypeName; readonly consume: number } | null {
    const args = scanTypeArgs(ctx, 1);
    if (args === null || args.lastType === null) {
        return null;
    }
    const name = asNamedType(args.lastType);
    if (name === null || ctx.peekAhead(1 + args.count).kind !== "identifier") {
        return null;
    }
    return { name, consume: 1 + args.count };
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
 * @stable
 * @example
 *     const ctx = createContext(lex("if c\n    x := 1\n").tokens);
 *     // after consuming `if c NEWLINE`, parseBlock reads the indented body
 *     void ctx;
 */
export function parseBlock(ctx: ParserContext): BlockStatement {
    // A comment-only first physical line emits a `newline` the cursor leaves
    // in place after skipping the comment; drop it so the `indent` that opens
    // the body is found.
    ctx.cursor.skipNewlines();
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

    // Container generic: `array<line> name`, `map<string, float> name`. The
    // element type becomes the annotation; consume the container + `<…>` so
    // the caller reads the variable name next.
    if (CONTAINER_TYPE_NAMES.has(token.text)) {
        const container = containerTypeAnnotation(ctx);
        if (container === null) {
            return null;
        }
        for (let i = 0; i < container.consume; i += 1) {
            ctx.cursor.next();
        }
        return { kind: "named-type", name: container.name, span: token.span };
    }

    const name = asNamedType(token.text);
    if (name === null) {
        return null;
    }

    // Array-typed declaration: `line[] name`. Consume the type + `[]`.
    if (hasArrayTypeSuffix(ctx)) {
        ctx.cursor.next();
        ctx.cursor.next();
        ctx.cursor.next();
        return { kind: "named-type", name, span: token.span };
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

// The operators that turn `name <op> expr` into an {@link Assignment}: plain
// `=`/`:=` plus the compound arithmetic forms (`count += 1`). A compound form
// is read-and-write of an existing scalar; the transform lowers it.
const ASSIGNMENT_OPERATORS: ReadonlySet<AssignmentOperator> = new Set<AssignmentOperator>([
    "=",
    ":=",
    "+=",
    "-=",
    "*=",
    "/=",
]);

function isAssignmentOperator(text: string): text is AssignmentOperator {
    return (ASSIGNMENT_OPERATORS as ReadonlySet<string>).has(text);
}

function parseAssignment(
    ctx: ParserContext,
    nameToken: Token,
    operatorText: AssignmentOperator,
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

// Whether the cursor (parked on `[`) opens a well-formed tuple-destructuring
// head `[ ident (, ident)* ] =`. Pure lookahead — a statement-leading `[ident`
// is unambiguously a destructuring attempt (a history access `x[1]` starts
// with the identifier, not `[`), but the full shape is validated so a
// malformed `[` line still routes to the `unexpected-token` recovery.
function looksLikeTupleDeclaration(ctx: ParserContext): boolean {
    let offset = 1;
    if (ctx.peekAhead(offset).kind !== "identifier") {
        return false;
    }
    offset += 1;
    for (;;) {
        const token = ctx.peekAhead(offset);
        if (token.kind === "punctuation" && token.text === ",") {
            offset += 1;
            if (ctx.peekAhead(offset).kind !== "identifier") {
                return false;
            }
            offset += 1;
            continue;
        }
        if (token.kind === "punctuation" && token.text === "]") {
            const after = ctx.peekAhead(offset + 1);
            return after.kind === "operator" && after.text === "=";
        }
        return false;
    }
}

// Parse a `[ ident (, ident)* ] = expr` tuple declaration. The head shape is
// pre-validated by {@link looksLikeTupleDeclaration}, so every `[`, name, `]`,
// and `=` token is known present and consumed directly.
function parseTupleDeclaration(ctx: ParserContext, start: Token): TupleDeclaration {
    ctx.cursor.next(); // `[`
    const names: TupleTarget[] = [];
    for (;;) {
        const nameToken = ctx.cursor.next(); // an identifier (guaranteed by the head guard)
        names.push({ name: nameToken.text, span: nameToken.span });
        if (ctx.cursor.match("punctuation", ",") === null) {
            break;
        }
    }
    ctx.cursor.match("punctuation", "]");
    ctx.cursor.match("operator", "=");
    const initializer = parseExpression(ctx);
    const end = ctx.cursor.peek().span;
    ctx.cursor.match("newline");
    return {
        kind: "tuple-declaration",
        names,
        initializer,
        span: spanBetween(start.span, end),
    };
}

// Whether the cursor (parked on an identifier) opens a Pine user-defined
// function declaration head — `identifier ( … ) =>`. Pure bounded lookahead:
// the `=>` immediately after the balanced parameter `)` is the unambiguous
// decl marker. A plain call `f(args)` or history `f(args)[n]` lacks it and
// routes to the existing expression/assignment path unchanged. The parameter
// list is scanned by paren depth so a nested `(` (inside an ultimately
// rejected default value) still finds the matching close; an unclosed head
// hits `eof` and is not a declaration.
function looksLikeFunctionDeclaration(ctx: ParserContext): boolean {
    const open = ctx.peekAhead(1);
    if (!(open.kind === "punctuation" && open.text === "(")) {
        return false;
    }
    let offset = 1;
    let depth = 0;
    for (;;) {
        const token = ctx.peekAhead(offset);
        if (token.kind === "eof") {
            return false;
        }
        if (token.kind === "punctuation" && token.text === "(") {
            depth += 1;
        } else if (token.kind === "punctuation" && token.text === ")") {
            depth -= 1;
            if (depth === 0) {
                const after = ctx.peekAhead(offset + 1);
                return after.kind === "operator" && after.text === "=>";
            }
        }
        offset += 1;
    }
}

// Parse the body of a user-defined function. A single-line body (`=> expr` on
// the same logical line) is wrapped in a one-statement {@link BlockStatement}
// whose sole `expression-statement` is the implicit return. A multi-line body
// (`=>` then `newline indent … dedent`) reuses {@link parseBlock}; its last
// statement is the implicit return.
function parseFunctionBody(ctx: ParserContext): BlockStatement {
    if (ctx.cursor.peekKind() === "newline") {
        ctx.cursor.next();
        return parseBlock(ctx);
    }
    const expression = parseExpression(ctx);
    const exprStatement: ExpressionStatement = {
        kind: "expression-statement",
        expression,
        span: expression.span,
    };
    ctx.cursor.match("newline");
    return { kind: "block-statement", body: [exprStatement], span: expression.span };
}

// Parse a `name ( params ) => body` user-defined function declaration. The head
// shape is pre-validated by {@link looksLikeFunctionDeclaration}, so the name,
// `(`, balanced `)`, and `=>` are known present. Parameters are bare
// identifiers (Pine v1 UDF params are untyped): a `float x` type prefix is
// dropped to the bare name with a `udf-typed-param-unsupported` warning; a
// defaulted (`x = 2`) or non-identifier param rejects the whole declaration
// (diagnostic + line/block recovery, returning `null` so no node is
// registered).
function parseFunctionDeclaration(ctx: ParserContext, start: Token): Statement | null {
    ctx.cursor.next(); // the function name (`start`)
    ctx.cursor.next(); // `(`
    const params: FunctionParam[] = [];
    if (ctx.cursor.peek().text !== ")") {
        for (;;) {
            const typed = ctx.cursor.peek();
            if (
                typed.kind === "identifier" &&
                asNamedType(typed.text) !== null &&
                ctx.peekAhead(1).kind === "identifier"
            ) {
                ctx.addDiagnostic(makeDiagnostic("udf-typed-param-unsupported", typed.span));
                ctx.cursor.next(); // drop the type annotation, keep the bare name
            }
            const nameToken = ctx.cursor.expect("identifier");
            if (nameToken === null) {
                ctx.addDiagnostic(
                    makeDiagnostic(
                        "expected-token",
                        ctx.cursor.peek().span,
                        "Expected a function parameter name.",
                    ),
                );
                recoverCompound(ctx);
                return null;
            }
            const afterName = ctx.cursor.peek();
            if (afterName.kind === "operator" && afterName.text === "=") {
                ctx.addDiagnostic(makeDiagnostic("udf-param-default-unsupported", nameToken.span));
                recoverCompound(ctx);
                return null;
            }
            params.push({ name: nameToken.text, span: nameToken.span });
            if (ctx.cursor.match("punctuation", ",") === null) {
                break;
            }
        }
    }
    ctx.cursor.match("punctuation", ")");
    ctx.cursor.match("operator", "=>");
    const body = parseFunctionBody(ctx);
    const declaration: FunctionDeclaration = {
        kind: "function-declaration",
        name: start.text,
        params,
        body,
        span: spanBetween(start.span, body.span),
    };
    return declaration;
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
    // A blank or comment-only line between/after the arms emits a stray
    // `newline` (the cursor skips comments but not the trailing newline); skip
    // those before the dedent check so they never parse as a malformed arm.
    for (;;) {
        ctx.cursor.skipNewlines();
        if (ctx.cursor.atEnd() || ctx.cursor.peekKind() === "dedent") {
            break;
        }
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
        // An inline arm body may be a single expression OR a comma-separated
        // assignment list (`a := 8, b := 21`). The lexer suppresses the
        // newline after a trailing `,`, so the list is one logical line; each
        // comma-separated element becomes its own statement in the arm body.
        for (;;) {
            const statement = parseStatement(ctx);
            if (statement !== null) {
                body.push(statement);
                endSpan = statement.span;
            }
            if (ctx.cursor.match("punctuation", ",") === null) {
                break;
            }
        }
    }
    return { test, body, span: spanBetween(startToken.span, endSpan) };
}

// One arm of a value-form `switch`, with `value` set to `null` for the residual
// unsupported sub-shape (a multi-line block body, a comma list, or a `:=`/`=`
// assignment arm — anything that is not a single expression).
type SwitchExpressionArm = Readonly<{
    test: ExpressionNode | null;
    value: ExpressionNode | null;
    span: SourceSpan;
}>;

// Parse one `label/cond => value` arm of a value-form `switch`. The test is the
// arm label/condition (or `null` for the wildcard `=> value` arm). Unlike a
// statement-form arm ({@link parseSwitchCase}), the body is parsed as a single
// EXPRESSION via {@link parseExpression} — so an array-literal arm value
// (`=> [1, 2]`) parses as a value, not a rejected statement-leading `[` tuple
// head. A multi-line block body, or a trailing `,`/`:=`/`=` (a comma list or an
// assignment arm), is the residual unsupported sub-shape: it is consumed and
// reported with `value: null`.
function parseSwitchExpressionArm(ctx: ParserContext): SwitchExpressionArm {
    const startToken = ctx.cursor.peek();
    const test = ctx.cursor.peek().text === "=>" ? null : parseExpression(ctx);
    ctx.cursor.match("operator", "=>");
    // A multi-line arm body (`=>` then a newline + indented block) is the
    // residual unsupported form; consume it so the next arm still parses.
    if (ctx.cursor.peekKind() === "newline") {
        ctx.cursor.next();
        const end =
            ctx.cursor.peekKind() === "indent" ? parseBlock(ctx).span : ctx.cursor.peek().span;
        return { test, value: null, span: spanBetween(startToken.span, end) };
    }
    const value = parseExpression(ctx);
    // A value arm is exactly one expression terminated by a newline; any other
    // trailing token (`,` comma list, `:=`/`=` assignment arm) is unsupported.
    if (ctx.cursor.peekKind() !== "newline") {
        recoverLine(ctx);
        return { test, value: null, span: spanBetween(startToken.span, value.span) };
    }
    ctx.cursor.next();
    return { test, value, span: spanBetween(startToken.span, value.span) };
}

/**
 * Parse a value-position `switch` (`x = switch s …`, the Pine `cf_ma` helper)
 * into a {@link SwitchExpression}. Each arm yields a single expression (parsed
 * by {@link parseSwitchExpressionArm}); the subject (`switch s`) is `null` for
 * the subject-less boolean form. An arm whose body is not a single expression (a
 * multi-statement block, a comma list, or a `:=`/`=` assignment) is the residual
 * unsupported sub-shape: one `switch-expression-unsupported` is recorded and the
 * whole `switch` degrades to an `unknown-expression`. A missing indented body
 * degrades the same way. The parser never throws.
 *
 * @since 0.1
 * @stable
 * @example
 *     const ctx = createContext(lex('x = switch s\n    "A" => 1\n').tokens);
 *     // after `x =`, parsePrimary delegates the `switch` keyword here
 *     void ctx;
 */
export function parseSwitchExpression(ctx: ParserContext): ExpressionNode {
    const start = ctx.cursor.next();
    const subject = ctx.cursor.peekKind() === "newline" ? null : parseExpression(ctx);
    ctx.cursor.match("newline");
    const open = ctx.cursor.expect("indent");
    if (open === null) {
        const at = ctx.cursor.peek().span;
        ctx.addDiagnostic(
            makeDiagnostic("expected-token", at, "Expected an indented `switch` body."),
        );
        return { kind: "unknown-expression", tokens: [], span: spanBetween(start.span, at) };
    }
    const cases: SwitchExpressionCase[] = [];
    let endSpan = open.span;
    let unsupported = false;
    // A blank or comment-only line between/after the arms emits a stray
    // `newline` (the cursor skips comments but not the trailing newline); skip
    // those before the dedent check so they never parse as a malformed arm and
    // misfire `switch-expression-unsupported`.
    for (;;) {
        ctx.cursor.skipNewlines();
        if (ctx.cursor.atEnd() || ctx.cursor.peekKind() === "dedent") {
            break;
        }
        const arm = parseSwitchExpressionArm(ctx);
        endSpan = arm.span;
        if (arm.value === null) {
            if (!unsupported) {
                ctx.addDiagnostic(makeDiagnostic("switch-expression-unsupported", arm.span));
                unsupported = true;
            }
            continue;
        }
        cases.push({ test: arm.test, value: arm.value, span: arm.span });
    }
    const close = ctx.cursor.expect("dedent");
    if (close !== null) {
        endSpan = close.span;
    }
    const span = spanBetween(start.span, endSpan);
    if (unsupported) {
        return { kind: "unknown-expression", tokens: [], span };
    }
    return { kind: "switch-expression", subject, cases, span };
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

// Whether `start` begins a no-`var` typed declaration: a scalar (`float x`),
// an array type (`line[] xs`), or a generic container (`array<line> xs`).
function startsTypedDeclaration(ctx: ParserContext, start: Token): boolean {
    if (CONTAINER_TYPE_NAMES.has(start.text)) {
        return containerTypeAnnotation(ctx) !== null;
    }
    if (asNamedType(start.text) === null) {
        return false;
    }
    return ctx.peekAhead(1).kind === "identifier" || hasArrayTypeSuffix(ctx);
}

function parseIdentifierStatement(ctx: ParserContext, start: Token): Statement {
    // A bare type keyword followed by an identifier is a typed declaration
    // (`float x = ...`, `line[] xs = ...`, `array<line> xs = ...`); otherwise
    // the leading identifier may be an assignment target or the head of an
    // expression statement.
    if (startsTypedDeclaration(ctx, start)) {
        return parseVariableDeclaration(ctx, "none", start);
    }
    const after = ctx.peekAhead(1);
    if (after.kind === "operator" && isAssignmentOperator(after.text)) {
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
 * @stable
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
    // A `name(params) =>` head is a user-defined function declaration; the `=>`
    // after the balanced `)` distinguishes it from a plain call / history,
    // which fall through to the identifier path below.
    if (start.kind === "identifier" && looksLikeFunctionDeclaration(ctx)) {
        return parseFunctionDeclaration(ctx, start);
    }
    if (start.kind === "identifier") {
        return parseIdentifierStatement(ctx, start);
    }
    // A statement-leading `[` is a tuple-destructuring head: a well-formed
    // `[ ident (, ident)* ] =` becomes a `TupleDeclaration`; any other
    // `[ … ]` head (a non-identifier target, a missing comma, a `:=`) is a
    // malformed destructuring and rejects with `unexpected-token`. A
    // value-position array literal (`options=[…]`, `f([…])`, `x = [...]`) is
    // never statement-leading — it is reached nested through `parseExpression`,
    // not this dispatch — so a leading `[` is never a bare array expression.
    if (start.kind === "punctuation" && start.text === "[") {
        if (looksLikeTupleDeclaration(ctx)) {
            return parseTupleDeclaration(ctx, start);
        }
        ctx.addDiagnostic(
            makeDiagnostic("unexpected-token", start.span, `Unexpected token \`${start.text}\`.`),
        );
        recoverLine(ctx);
        return null;
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
