// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Token } from "../lexer/index.js";
import type { WithSpan } from "./spans.js";

/**
 * An identifier reference (`close`, `myVar`, `line`). The qualified-name
 * resolution (built-in vs local) happens later in semantic analysis.
 *
 * @since 0.1
 * @stable
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
 * Lexical category of a {@link LiteralExpression} value. `na` is modeled
 * separately as {@link NaExpression}; it appears here only for the typed
 * views that read a literal token's kind.
 *
 * @since 0.1
 * @stable
 * @example
 *     const t: LiteralKind = "int";
 *     void t;
 */
export type LiteralKind = "int" | "float" | "string" | "color" | "bool" | "na";

/**
 * A literal value (`42`, `1.5`, `"hi"`, `#ff0000`, `true`). `value` is the
 * source text; typed views (`numericValue`, `stringValue`) come off the
 * originating {@link Token} during later passes. The `na` keyword is its
 * own {@link NaExpression} node, not a literal.
 *
 * @since 0.1
 * @stable
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
 * The `na` keyword used as a value — Pine's "no value" sentinel. Kept as a
 * dedicated node so later passes can treat it specially without inspecting
 * a literal's text.
 *
 * @since 0.1
 * @stable
 * @example
 *     const e: NaExpression = {
 *         kind: "na-expression",
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 3 },
 *     };
 *     void e;
 */
export type NaExpression = WithSpan & Readonly<{ kind: "na-expression" }>;

/**
 * A prefix unary expression: `-x`, `+x`, or `not flag`.
 *
 * @since 0.1
 * @stable
 * @example
 *     const e: UnaryExpression = {
 *         kind: "unary-expression",
 *         operator: "-",
 *         operand: {
 *             kind: "identifier-expression",
 *             name: "x",
 *             span: { startLine: 1, startColumn: 2, endLine: 1, endColumn: 3 },
 *         },
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 3 },
 *     };
 *     void e;
 */
export type UnaryExpression = WithSpan &
    Readonly<{
        kind: "unary-expression";
        operator: "+" | "-" | "not";
        operand: ExpressionNode;
    }>;

/**
 * A binary operator expression. `operator` is the source token text
 * (`+`, `-`, `*`, `/`, `%`, `==`, `!=`, `<`, `<=`, `>`, `>=`, `and`,
 * `or`).
 *
 * @since 0.1
 * @stable
 * @example
 *     const e: BinaryExpression = {
 *         kind: "binary-expression",
 *         operator: "+",
 *         left: {
 *             kind: "identifier-expression",
 *             name: "a",
 *             span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
 *         },
 *         right: {
 *             kind: "identifier-expression",
 *             name: "b",
 *             span: { startLine: 1, startColumn: 5, endLine: 1, endColumn: 6 },
 *         },
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 6 },
 *     };
 *     void e;
 */
export type BinaryExpression = WithSpan &
    Readonly<{
        kind: "binary-expression";
        operator: string;
        left: ExpressionNode;
        right: ExpressionNode;
    }>;

/**
 * A ternary `condition ? consequent : alternate` expression.
 *
 * @since 0.1
 * @stable
 * @example
 *     const lit = (v: string, col: number) =>
 *         ({
 *             kind: "literal-expression",
 *             literalKind: "int",
 *             value: v,
 *             span: { startLine: 1, startColumn: col, endLine: 1, endColumn: col + 1 },
 *         }) as const;
 *     const e: TernaryExpression = {
 *         kind: "ternary-expression",
 *         condition: {
 *             kind: "identifier-expression",
 *             name: "c",
 *             span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
 *         },
 *         consequent: lit("1", 5),
 *         alternate: lit("2", 9),
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 10 },
 *     };
 *     void e;
 */
export type TernaryExpression = WithSpan &
    Readonly<{
        kind: "ternary-expression";
        condition: ExpressionNode;
        consequent: ExpressionNode;
        alternate: ExpressionNode;
    }>;

/**
 * A single call argument. `name` is `null` for a positional argument and
 * the parameter name for a named argument (`length = 9`).
 *
 * @since 0.1
 * @stable
 * @example
 *     const arg: CallArgument = {
 *         name: "length",
 *         value: {
 *             kind: "literal-expression",
 *             literalKind: "int",
 *             value: "9",
 *             span: { startLine: 1, startColumn: 14, endLine: 1, endColumn: 15 },
 *         },
 *         span: { startLine: 1, startColumn: 5, endLine: 1, endColumn: 15 },
 *     };
 *     void arg;
 */
export type CallArgument = WithSpan &
    Readonly<{
        name: string | null;
        value: ExpressionNode;
    }>;

/**
 * A function call (`ta.ema(close, 9)`, `chart.point.new(t, i, p)`).
 * `callee` is the identifier or member-access being invoked.
 *
 * @since 0.1
 * @stable
 * @example
 *     const e: CallExpression = {
 *         kind: "call-expression",
 *         callee: {
 *             kind: "identifier-expression",
 *             name: "plot",
 *             span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 5 },
 *         },
 *         args: [],
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 7 },
 *     };
 *     void e;
 */
export type CallExpression = WithSpan &
    Readonly<{
        kind: "call-expression";
        callee: ExpressionNode;
        args: readonly CallArgument[];
    }>;

/**
 * A member-access chain (`a.b.c`). When the chain starts at a bare
 * identifier (the v1 common case — `ta.ema`, `chart.point.new`), `head` is
 * `null` and the dotted names accumulate into `chain`. `head` is non-null
 * only when the receiver is itself a computed expression.
 *
 * @since 0.1
 * @stable
 * @example
 *     const e: MemberAccessExpression = {
 *         kind: "member-access-expression",
 *         head: null,
 *         chain: ["ta", "ema"],
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 7 },
 *     };
 *     void e;
 */
export type MemberAccessExpression = WithSpan &
    Readonly<{
        kind: "member-access-expression";
        head: ExpressionNode | null;
        chain: readonly string[];
    }>;

/**
 * Pine's history-reference operator `receiver[offset]` — the value of
 * `receiver` `offset` bars ago. Chains left-associatively (`x[1][2]`).
 *
 * @since 0.1
 * @stable
 * @example
 *     const e: HistoryAccessExpression = {
 *         kind: "history-access-expression",
 *         receiver: {
 *             kind: "identifier-expression",
 *             name: "close",
 *             span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 6 },
 *         },
 *         offset: {
 *             kind: "literal-expression",
 *             literalKind: "int",
 *             value: "1",
 *             span: { startLine: 1, startColumn: 7, endLine: 1, endColumn: 8 },
 *         },
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 9 },
 *     };
 *     void e;
 */
export type HistoryAccessExpression = WithSpan &
    Readonly<{
        kind: "history-access-expression";
        receiver: ExpressionNode;
        offset: ExpressionNode;
    }>;

/**
 * A parenthesized expression `( expression )`. Preserved as a node so the
 * round-trip emitter can reproduce explicit grouping.
 *
 * @since 0.1
 * @stable
 * @example
 *     const e: ParenExpression = {
 *         kind: "paren-expression",
 *         expression: {
 *             kind: "identifier-expression",
 *             name: "x",
 *             span: { startLine: 1, startColumn: 2, endLine: 1, endColumn: 3 },
 *         },
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 4 },
 *     };
 *     void e;
 */
export type ParenExpression = WithSpan &
    Readonly<{
        kind: "paren-expression";
        expression: ExpressionNode;
    }>;

/**
 * A parenthesized comma list `(a, b)` — Pine's only multi-value form, used
 * for multi-return destructuring. A single parenthesized expression is a
 * {@link ParenExpression}; two or more elements make a tuple.
 *
 * @since 0.1
 * @stable
 * @example
 *     const ident = (n: string, col: number) =>
 *         ({
 *             kind: "identifier-expression",
 *             name: n,
 *             span: { startLine: 1, startColumn: col, endLine: 1, endColumn: col + 1 },
 *         }) as const;
 *     const e: TupleExpression = {
 *         kind: "tuple-expression",
 *         elements: [ident("a", 2), ident("b", 5)],
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 6 },
 *     };
 *     void e;
 */
export type TupleExpression = WithSpan &
    Readonly<{
        kind: "tuple-expression";
        elements: readonly ExpressionNode[];
    }>;

/**
 * A value-position array literal `[a, b, c]` — Pine's `array.from`-style
 * bracket list when it appears as a value (an `options=` named-arg value, a
 * call argument, or a right-hand side), distinct from the postfix
 * history-access `x[n]` and the statement-leading `[a, b] = …` tuple
 * destructuring. `elements` are parsed via the full expression grammar; an
 * empty `[]` carries no elements.
 *
 * @since 0.1
 * @stable
 * @example
 *     const lit = (v: string, col: number) =>
 *         ({
 *             kind: "literal-expression",
 *             literalKind: "string",
 *             value: v,
 *             span: { startLine: 1, startColumn: col, endLine: 1, endColumn: col + 5 },
 *         }) as const;
 *     const e: ArrayLiteralExpression = {
 *         kind: "array-literal-expression",
 *         elements: [lit('"SMA"', 2), lit('"EMA"', 9)],
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 14 },
 *     };
 *     void e;
 */
export type ArrayLiteralExpression = WithSpan &
    Readonly<{
        kind: "array-literal-expression";
        elements: readonly ExpressionNode[];
    }>;

/**
 * A lambda `(x, y) => body`. Parsed surface-faithfully; the transform layer
 * rejects it (no chartlang analogue in v1) rather than the parser, so later
 * passes can report a single contextual diagnostic (e.g. for `array.map`).
 *
 * @since 0.1
 * @stable
 * @example
 *     const e: LambdaExpression = {
 *         kind: "lambda-expression",
 *         params: ["x"],
 *         body: {
 *             kind: "identifier-expression",
 *             name: "x",
 *             span: { startLine: 1, startColumn: 8, endLine: 1, endColumn: 9 },
 *         },
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 9 },
 *     };
 *     void e;
 */
export type LambdaExpression = WithSpan &
    Readonly<{
        kind: "lambda-expression";
        params: readonly string[];
        body: ExpressionNode;
    }>;

/**
 * Opaque expression placeholder for an unrecoverable span — emitted when no
 * prefix rule can start an expression at the cursor. It captures the raw
 * {@link Token}s consumed so the surrounding statement still gets a
 * well-formed span and the parser never throws.
 *
 * @since 0.1
 * @stable
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
 * Any Pine v6 expression node — the full operator / call / member / history
 * / ternary / tuple / lambda grammar produced by the Task 4 Pratt parser.
 *
 * @since 0.1
 * @stable
 * @example
 *     const e: ExpressionNode = {
 *         kind: "identifier-expression",
 *         name: "open",
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 5 },
 *     };
 *     void e;
 */
export type ExpressionNode =
    | IdentifierExpression
    | LiteralExpression
    | NaExpression
    | UnaryExpression
    | BinaryExpression
    | TernaryExpression
    | CallExpression
    | MemberAccessExpression
    | HistoryAccessExpression
    | ParenExpression
    | TupleExpression
    | ArrayLiteralExpression
    | LambdaExpression
    | UnknownExpression;
