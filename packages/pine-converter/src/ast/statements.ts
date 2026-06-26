// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { SourceSpan } from "../index.js";
import type { ExpressionNode } from "./expressions.js";
import type { WithSpan } from "./spans.js";
import type { TypeAnnotation } from "./types.js";

/**
 * A `{ Statement+ }` block introduced by an `indent`/`dedent` pair. Blocks
 * never stand alone — they only appear inside `if`/`for`/`switch` bodies.
 *
 * @since 0.1
 * @stable
 * @example
 *     const b: BlockStatement = {
 *         kind: "block-statement",
 *         body: [],
 *         span: { startLine: 2, startColumn: 5, endLine: 2, endColumn: 5 },
 *     };
 *     void b;
 */
export type BlockStatement = WithSpan &
    Readonly<{
        kind: "block-statement";
        body: readonly Statement[];
    }>;

/**
 * Persistence qualifier on a {@link VariableDeclaration}: `var` (persists
 * across bars), `varip` (persists across intrabar ticks), or `none` (a
 * plain per-bar declaration).
 *
 * @since 0.1
 * @stable
 * @example
 *     const q: DeclarationQualifier = "var";
 *     void q;
 */
export type DeclarationQualifier = "var" | "varip" | "none";

/**
 * A variable declaration: an optional `var`/`varip` qualifier, an optional
 * {@link TypeAnnotation}, an identifier, and an initializer expression.
 *
 * @since 0.1
 * @stable
 * @example
 *     const s: VariableDeclaration = {
 *         kind: "variable-declaration",
 *         qualifier: "var",
 *         typeAnnotation: null,
 *         name: "count",
 *         initializer: {
 *             kind: "literal-expression",
 *             literalKind: "int",
 *             value: "0",
 *             span: { startLine: 1, startColumn: 13, endLine: 1, endColumn: 14 },
 *         },
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 14 },
 *     };
 *     void s;
 */
export type VariableDeclaration = WithSpan &
    Readonly<{
        kind: "variable-declaration";
        qualifier: DeclarationQualifier;
        typeAnnotation: TypeAnnotation | null;
        name: string;
        initializer: ExpressionNode;
    }>;

/**
 * The assignment operator: `=` (declaration-or-reassignment, disambiguated
 * by Task 5's semantic analyzer), `:=` (explicit reassignment), or a compound
 * arithmetic assignment (`+=`/`-=`/`*=`/`/=`) that reads-and-writes an
 * existing scalar (`count += 1` ≡ `count := count + 1`).
 *
 * @since 0.1
 * @stable
 * @example
 *     const op: AssignmentOperator = "+=";
 *     void op;
 */
export type AssignmentOperator = "=" | ":=" | "+=" | "-=" | "*=" | "/=";

/**
 * An assignment / reassignment to an existing identifier.
 *
 * @since 0.1
 * @stable
 * @example
 *     const s: Assignment = {
 *         kind: "assignment",
 *         operator: ":=",
 *         name: "x",
 *         value: {
 *             kind: "identifier-expression",
 *             name: "y",
 *             span: { startLine: 1, startColumn: 6, endLine: 1, endColumn: 7 },
 *         },
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 7 },
 *     };
 *     void s;
 */
export type Assignment = WithSpan &
    Readonly<{
        kind: "assignment";
        operator: AssignmentOperator;
        name: string;
        value: ExpressionNode;
    }>;

/**
 * One `else if` arm of an {@link IfStatement}: a condition plus its block.
 *
 * @since 0.1
 * @stable
 * @example
 *     const arm: ElseIfClause = {
 *         condition: {
 *             kind: "identifier-expression",
 *             name: "cond",
 *             span: { startLine: 3, startColumn: 9, endLine: 3, endColumn: 13 },
 *         },
 *         body: {
 *             kind: "block-statement",
 *             body: [],
 *             span: { startLine: 4, startColumn: 5, endLine: 4, endColumn: 5 },
 *         },
 *         span: { startLine: 3, startColumn: 1, endLine: 4, endColumn: 5 },
 *     };
 *     void arm;
 */
export type ElseIfClause = WithSpan &
    Readonly<{
        condition: ExpressionNode;
        body: BlockStatement;
    }>;

/**
 * An `if`/`else if`/`else` statement. `elseIfClauses` is the (possibly
 * empty) list of `else if` arms; `elseBody` is `null` when there is no
 * trailing `else`.
 *
 * @since 0.1
 * @stable
 * @example
 *     const s: IfStatement = {
 *         kind: "if-statement",
 *         condition: {
 *             kind: "identifier-expression",
 *             name: "cond",
 *             span: { startLine: 1, startColumn: 4, endLine: 1, endColumn: 8 },
 *         },
 *         thenBody: {
 *             kind: "block-statement",
 *             body: [],
 *             span: { startLine: 2, startColumn: 5, endLine: 2, endColumn: 5 },
 *         },
 *         elseIfClauses: [],
 *         elseBody: null,
 *         span: { startLine: 1, startColumn: 1, endLine: 2, endColumn: 5 },
 *     };
 *     void s;
 */
export type IfStatement = WithSpan &
    Readonly<{
        kind: "if-statement";
        condition: ExpressionNode;
        thenBody: BlockStatement;
        elseIfClauses: readonly ElseIfClause[];
        elseBody: BlockStatement | null;
    }>;

/**
 * A literal-bounded `for i = a to b [by step]` loop. `step` is `null` when
 * the `by` clause is absent.
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
 *     const s: ForStatement = {
 *         kind: "for-statement",
 *         variable: "i",
 *         from: lit("0", 9),
 *         to: lit("9", 14),
 *         step: null,
 *         body: {
 *             kind: "block-statement",
 *             body: [],
 *             span: { startLine: 2, startColumn: 5, endLine: 2, endColumn: 5 },
 *         },
 *         span: { startLine: 1, startColumn: 1, endLine: 2, endColumn: 5 },
 *     };
 *     void s;
 */
export type ForStatement = WithSpan &
    Readonly<{
        kind: "for-statement";
        variable: string;
        from: ExpressionNode;
        to: ExpressionNode;
        step: ExpressionNode | null;
        body: BlockStatement;
    }>;

/**
 * One arm of a {@link SwitchStatement}. `test` is `null` for the default
 * `=> …` arm.
 *
 * @since 0.1
 * @stable
 * @example
 *     const arm: SwitchCase = {
 *         test: null,
 *         body: [],
 *         span: { startLine: 2, startColumn: 5, endLine: 2, endColumn: 5 },
 *     };
 *     void arm;
 */
export type SwitchCase = WithSpan &
    Readonly<{
        test: ExpressionNode | null;
        body: readonly Statement[];
    }>;

/**
 * A `switch` statement. `subject` is `null` for the condition-less form
 * (`switch` with boolean `case =>` arms).
 *
 * @since 0.1
 * @stable
 * @example
 *     const s: SwitchStatement = {
 *         kind: "switch-statement",
 *         subject: null,
 *         cases: [],
 *         span: { startLine: 1, startColumn: 1, endLine: 2, endColumn: 5 },
 *     };
 *     void s;
 */
export type SwitchStatement = WithSpan &
    Readonly<{
        kind: "switch-statement";
        subject: ExpressionNode | null;
        cases: readonly SwitchCase[];
    }>;

/**
 * A `break` statement.
 *
 * @since 0.1
 * @stable
 * @example
 *     const s: BreakStatement = {
 *         kind: "break-statement",
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 6 },
 *     };
 *     void s;
 */
export type BreakStatement = WithSpan & Readonly<{ kind: "break-statement" }>;

/**
 * A `continue` statement.
 *
 * @since 0.1
 * @stable
 * @example
 *     const s: ContinueStatement = {
 *         kind: "continue-statement",
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 9 },
 *     };
 *     void s;
 */
export type ContinueStatement = WithSpan & Readonly<{ kind: "continue-statement" }>;

/**
 * A `return` statement. `value` is `null` for a bare `return`.
 *
 * @since 0.1
 * @stable
 * @example
 *     const s: ReturnStatement = {
 *         kind: "return-statement",
 *         value: null,
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 7 },
 *     };
 *     void s;
 */
export type ReturnStatement = WithSpan &
    Readonly<{
        kind: "return-statement";
        value: ExpressionNode | null;
    }>;

/**
 * One destructuring target in a {@link TupleDeclaration}: the bound name and
 * the span of its identifier token. Each name carries its own span so the
 * semantic pass can register a distinct symbol per element (the `symbols` map
 * is keyed by span).
 *
 * @since 0.1
 * @stable
 * @example
 *     const t: TupleTarget = {
 *         name: "macdLine",
 *         span: { startLine: 1, startColumn: 2, endLine: 1, endColumn: 10 },
 *     };
 *     void t;
 */
export type TupleTarget = Readonly<{
    name: string;
    span: SourceSpan;
}>;

/**
 * A Pine tuple-destructuring declaration — `[a, b, c] = expr` — binding the
 * positional outputs of a multi-return call (e.g. `ta.macd`). Always a fresh
 * declaration (`=`, never `:=`); the names are ordered to match the call's
 * positional return.
 *
 * @since 0.1
 * @stable
 * @example
 *     const s: TupleDeclaration = {
 *         kind: "tuple-declaration",
 *         names: [
 *             { name: "a", span: { startLine: 1, startColumn: 2, endLine: 1, endColumn: 3 } },
 *         ],
 *         initializer: {
 *             kind: "identifier-expression",
 *             name: "f",
 *             span: { startLine: 1, startColumn: 7, endLine: 1, endColumn: 8 },
 *         },
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 8 },
 *     };
 *     void s;
 */
export type TupleDeclaration = WithSpan &
    Readonly<{
        kind: "tuple-declaration";
        names: readonly TupleTarget[];
        initializer: ExpressionNode;
    }>;

/**
 * One parameter of a {@link FunctionDeclaration}: the bound name and the span
 * of its identifier token. Each param carries its own span so the semantic
 * pass (Task 2) can register a distinct symbol per parameter without a span
 * collision (same precedent as {@link TupleTarget}). Pine v1 UDF params are
 * untyped — a `float x` type prefix is dropped to the bare name `x` with a
 * `udf-typed-param-unsupported` warning, and a defaulted param rejects the
 * whole declaration, so no `default` field is modeled here.
 *
 * @since 0.1
 * @stable
 * @example
 *     const p: FunctionParam = {
 *         name: "length",
 *         span: { startLine: 1, startColumn: 8, endLine: 1, endColumn: 14 },
 *     };
 *     void p;
 */
export type FunctionParam = WithSpan &
    Readonly<{
        name: string;
    }>;

/**
 * A Pine user-defined function declaration — `name(params) => body` — in both
 * the single-line (`f(a, b) => expr`) and multi-line (`f(a) =>` + indented
 * block) forms. `body` is always a {@link BlockStatement}; the single-line form
 * wraps its expression in a one-statement block. By Pine convention the body's
 * **last** statement is the implicit return value (Pine has no `return`
 * keyword in UDFs), so no explicit return node is synthesized. Parse-only —
 * statefulness classification and emission live in Tasks 2–4.
 *
 * @since 0.1
 * @stable
 * @example
 *     const s: FunctionDeclaration = {
 *         kind: "function-declaration",
 *         name: "cf_slope",
 *         params: [
 *             { name: "ma", span: { startLine: 1, startColumn: 10, endLine: 1, endColumn: 12 } },
 *         ],
 *         body: {
 *             kind: "block-statement",
 *             body: [],
 *             span: { startLine: 1, startColumn: 18, endLine: 1, endColumn: 18 },
 *         },
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 18 },
 *     };
 *     void s;
 */
export type FunctionDeclaration = WithSpan &
    Readonly<{
        kind: "function-declaration";
        name: string;
        params: readonly FunctionParam[];
        body: BlockStatement;
    }>;

/**
 * A bare expression used in statement position (e.g. a `plot(...)` call).
 *
 * @since 0.1
 * @stable
 * @example
 *     const s: ExpressionStatement = {
 *         kind: "expression-statement",
 *         expression: {
 *             kind: "identifier-expression",
 *             name: "foo",
 *             span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 4 },
 *         },
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 4 },
 *     };
 *     void s;
 */
export type ExpressionStatement = WithSpan &
    Readonly<{
        kind: "expression-statement";
        expression: ExpressionNode;
    }>;

/**
 * Any Pine v6 statement node.
 *
 * @since 0.1
 * @stable
 * @example
 *     const s: Statement = {
 *         kind: "break-statement",
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 6 },
 *     };
 *     void s;
 */
export type Statement =
    | VariableDeclaration
    | Assignment
    | TupleDeclaration
    | FunctionDeclaration
    | IfStatement
    | ForStatement
    | SwitchStatement
    | BreakStatement
    | ContinueStatement
    | ReturnStatement
    | ExpressionStatement
    | BlockStatement;
