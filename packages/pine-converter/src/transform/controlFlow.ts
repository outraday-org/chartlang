// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ExpressionNode, LiteralExpression } from "../ast/index.js";
import type { ForStatement, IfStatement, Statement, SwitchStatement } from "../ast/statements.js";
import type { DiagnosticCollector } from "./diagnosticCollector.js";
import type { EmitContext } from "./emitContext.js";
import { emitWithContext } from "./emitContext.js";
import { expressionHasStatefulPrimitive } from "./statefulNames.js";

/**
 * The callback an enclosing transform supplies so the control-flow lowerers
 * can recursively render the statements inside an `if`/`for`/`switch` body.
 * Returns one chartlang source string per emitted statement (already
 * input-/state-rewritten). The orchestrator owns the per-statement dispatch
 * (and the drawing-ownership skip); the lowerers only assemble the block
 * scaffolding around the rendered children.
 *
 * @since 0.1
 * @stable
 * @example
 *     const emit: BodyEmitter = (stmts, ctx) => {
 *         void stmts;
 *         void ctx;
 *         return [];
 *     };
 *     void emit;
 */
export type BodyEmitter = (statements: readonly Statement[], ctx: EmitContext) => readonly string[];

// A compile-time-resolvable integer bound: a literal int, a unary `+`/`-` on a
// literal int, or an `input.int` default the caller resolved. `null` means
// the bound is non-resolvable (a runtime expression).
function literalInt(node: ExpressionNode): number | null {
    if (node.kind === "literal-expression" && node.literalKind === "int") {
        return Number.parseInt(node.value, 10);
    }
    if (
        node.kind === "unary-expression" &&
        (node.operator === "+" || node.operator === "-") &&
        node.operand.kind === "literal-expression" &&
        node.operand.literalKind === "int"
    ) {
        const magnitude = Number.parseInt(node.operand.value, 10);
        return node.operator === "-" ? -magnitude : magnitude;
    }
    return null;
}

/**
 * A resolved `for` bound: a compile-time integer plus whether it came from an
 * `input.int` default (so the unroll path can warn that the count is frozen).
 *
 * @since 0.1
 * @stable
 * @example
 *     const b: ResolvedBound = { value: 9, fromInputDefault: true };
 *     void b;
 */
export type ResolvedBound = Readonly<{
    value: number;
    fromInputDefault: boolean;
    inputName?: string;
}>;

/**
 * Resolve a `for` bound expression to a compile-time integer. A literal /
 * unary-literal resolves directly; a bare identifier naming a registered
 * input resolves to that input's recorded literal default via `inputDefault`.
 * Returns `null` when the bound is a runtime expression.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { resolveBound } from "./controlFlow.js";
 *     const node = {
 *         kind: "literal-expression",
 *         literalKind: "int",
 *         value: "9",
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
 *     } as const;
 *     resolveBound(node, () => null); // { value: 9, fromInputDefault: false }
 */
export function resolveBound(
    node: ExpressionNode,
    inputDefault: (name: string) => number | null,
): ResolvedBound | null {
    const direct = literalInt(node);
    if (direct !== null) {
        return { value: direct, fromInputDefault: false };
    }
    if (node.kind === "identifier-expression") {
        const fromInput = inputDefault(node.name);
        if (fromInput !== null) {
            return { value: fromInput, fromInputDefault: true, inputName: node.name };
        }
    }
    return null;
}

/**
 * Substitute the loop-iterator identifier with its concrete integer value
 * across an expression tree, so an unrolled body emits `close[2]` from
 * `close[i]`. Mirrors the same substitution `tables.ts` uses for table-write
 * loop unrolls.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { substituteIterator } from "./controlFlow.js";
 *     const node = {
 *         kind: "identifier-expression",
 *         name: "i",
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
 *     } as const;
 *     const out = substituteIterator(node, "i", 2);
 *     void out; // a literal-expression with value "2"
 */
export function substituteIterator(
    node: ExpressionNode,
    variable: string,
    value: number,
): ExpressionNode {
    switch (node.kind) {
        case "identifier-expression":
            if (node.name === variable) {
                const literal: LiteralExpression = {
                    kind: "literal-expression",
                    literalKind: "int",
                    value: String(value),
                    span: node.span,
                };
                return literal;
            }
            return node;
        case "unary-expression":
            return { ...node, operand: substituteIterator(node.operand, variable, value) };
        case "binary-expression":
            return {
                ...node,
                left: substituteIterator(node.left, variable, value),
                right: substituteIterator(node.right, variable, value),
            };
        case "ternary-expression":
            return {
                ...node,
                condition: substituteIterator(node.condition, variable, value),
                consequent: substituteIterator(node.consequent, variable, value),
                alternate: substituteIterator(node.alternate, variable, value),
            };
        case "call-expression":
            return {
                ...node,
                callee: substituteIterator(node.callee, variable, value),
                args: node.args.map((arg) => ({
                    ...arg,
                    value: substituteIterator(arg.value, variable, value),
                })),
            };
        case "member-access-expression":
            return node.head === null
                ? node
                : { ...node, head: substituteIterator(node.head, variable, value) };
        case "history-access-expression":
            return {
                ...node,
                receiver: substituteIterator(node.receiver, variable, value),
                offset: substituteIterator(node.offset, variable, value),
            };
        case "paren-expression":
            return { ...node, expression: substituteIterator(node.expression, variable, value) };
        case "tuple-expression":
        case "array-literal-expression":
            return {
                ...node,
                elements: node.elements.map((el) => substituteIterator(el, variable, value)),
            };
        case "lambda-expression":
            return { ...node, body: substituteIterator(node.body, variable, value) };
        case "switch-expression":
            return {
                ...node,
                subject:
                    node.subject === null
                        ? null
                        : substituteIterator(node.subject, variable, value),
                cases: node.cases.map((arm) => ({
                    ...arm,
                    test: arm.test === null ? null : substituteIterator(arm.test, variable, value),
                    value: substituteIterator(arm.value, variable, value),
                })),
            };
        default:
            return node;
    }
}

// Substitute the iterator across a whole statement (recursing into nested
// control-flow + call args) so an unrolled body's statements carry the
// concrete index.
function substituteStatement(stmt: Statement, variable: string, value: number): Statement {
    switch (stmt.kind) {
        case "expression-statement":
            return { ...stmt, expression: substituteIterator(stmt.expression, variable, value) };
        case "variable-declaration":
            return { ...stmt, initializer: substituteIterator(stmt.initializer, variable, value) };
        case "assignment":
            return { ...stmt, value: substituteIterator(stmt.value, variable, value) };
        case "if-statement":
            return {
                ...stmt,
                condition: substituteIterator(stmt.condition, variable, value),
                thenBody: substituteBlock(stmt.thenBody, variable, value),
                elseIfClauses: stmt.elseIfClauses.map((clause) => ({
                    ...clause,
                    condition: substituteIterator(clause.condition, variable, value),
                    body: substituteBlock(clause.body, variable, value),
                })),
                elseBody:
                    stmt.elseBody === null ? null : substituteBlock(stmt.elseBody, variable, value),
            };
        case "enum-declaration":
            return stmt;
        default:
            return stmt;
    }
}

function substituteBlock(
    block: Extract<Statement, { kind: "block-statement" }>,
    variable: string,
    value: number,
): Extract<Statement, { kind: "block-statement" }> {
    return {
        ...block,
        body: block.body.map((inner) => substituteStatement(inner, variable, value)),
    };
}

/**
 * Substitute identifiers across an expression tree per a `name → replacement
 * node` map, returning a structurally-rebuilt clone. The node→node
 * generalisation of {@link substituteIterator} (which substitutes name→literal):
 * the UDF inliner uses it to replace a stateful helper's parameters with their
 * argument expressions (or a hoisted temp identifier) and its body locals with
 * uniquely-named synthesized locals. An identifier whose name is not a key is
 * left untouched, so an arg/local reference flows through to `emitExpr`'s own
 * remaps unchanged.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { substituteParams } from "./controlFlow.js";
 *     const span = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 } as const;
 *     const node = { kind: "identifier-expression", name: "x", span } as const;
 *     const repl = { kind: "identifier-expression", name: "close", span } as const;
 *     substituteParams(node, new Map([["x", repl]])); // the `close` node
 */
export function substituteParams(
    node: ExpressionNode,
    bindings: ReadonlyMap<string, ExpressionNode>,
): ExpressionNode {
    switch (node.kind) {
        case "identifier-expression":
            return bindings.get(node.name) ?? node;
        case "unary-expression":
            return { ...node, operand: substituteParams(node.operand, bindings) };
        case "binary-expression":
            return {
                ...node,
                left: substituteParams(node.left, bindings),
                right: substituteParams(node.right, bindings),
            };
        case "ternary-expression":
            return {
                ...node,
                condition: substituteParams(node.condition, bindings),
                consequent: substituteParams(node.consequent, bindings),
                alternate: substituteParams(node.alternate, bindings),
            };
        case "call-expression":
            return {
                ...node,
                callee: substituteParams(node.callee, bindings),
                args: node.args.map((arg) => ({
                    ...arg,
                    value: substituteParams(arg.value, bindings),
                })),
            };
        case "member-access-expression":
            return node.head === null
                ? node
                : { ...node, head: substituteParams(node.head, bindings) };
        case "history-access-expression":
            return {
                ...node,
                receiver: substituteParams(node.receiver, bindings),
                offset: substituteParams(node.offset, bindings),
            };
        case "paren-expression":
            return { ...node, expression: substituteParams(node.expression, bindings) };
        case "tuple-expression":
        case "array-literal-expression":
            return {
                ...node,
                elements: node.elements.map((el) => substituteParams(el, bindings)),
            };
        case "lambda-expression":
            return { ...node, body: substituteParams(node.body, bindings) };
        case "switch-expression":
            return {
                ...node,
                subject: node.subject === null ? null : substituteParams(node.subject, bindings),
                cases: node.cases.map((arm) => ({
                    ...arm,
                    test: arm.test === null ? null : substituteParams(arm.test, bindings),
                    value: substituteParams(arm.value, bindings),
                })),
            };
        default:
            return node;
    }
}

/**
 * Substitute identifiers across a whole statement (recursing into `if` bodies +
 * call args) per a `name → replacement node` map — the statement-level companion
 * to {@link substituteParams}, used by the UDF inliner to substitute params into
 * a stateful helper's control-flow body statement before re-lowering it. Mirrors
 * the kinds {@link substituteParams}' iterator sibling handles; any other kind
 * passes through unchanged.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { substituteParamsStatement } from "./controlFlow.js";
 *     const span = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 } as const;
 *     const stmt = {
 *         kind: "expression-statement",
 *         expression: { kind: "identifier-expression", name: "x", span },
 *         span,
 *     } as const;
 *     const repl = { kind: "identifier-expression", name: "close", span } as const;
 *     substituteParamsStatement(stmt, new Map([["x", repl]]));
 */
export function substituteParamsStatement(
    stmt: Statement,
    bindings: ReadonlyMap<string, ExpressionNode>,
): Statement {
    switch (stmt.kind) {
        case "expression-statement":
            return { ...stmt, expression: substituteParams(stmt.expression, bindings) };
        case "variable-declaration":
            return { ...stmt, initializer: substituteParams(stmt.initializer, bindings) };
        case "assignment":
            return { ...stmt, value: substituteParams(stmt.value, bindings) };
        case "if-statement":
            return {
                ...stmt,
                condition: substituteParams(stmt.condition, bindings),
                thenBody: substituteParamsBlock(stmt.thenBody, bindings),
                elseIfClauses: stmt.elseIfClauses.map((clause) => ({
                    ...clause,
                    condition: substituteParams(clause.condition, bindings),
                    body: substituteParamsBlock(clause.body, bindings),
                })),
                elseBody:
                    stmt.elseBody === null ? null : substituteParamsBlock(stmt.elseBody, bindings),
            };
        case "enum-declaration":
            return stmt;
        default:
            return stmt;
    }
}

function substituteParamsBlock(
    block: Extract<Statement, { kind: "block-statement" }>,
    bindings: ReadonlyMap<string, ExpressionNode>,
): Extract<Statement, { kind: "block-statement" }> {
    return {
        ...block,
        body: block.body.map((inner) => substituteParamsStatement(inner, bindings)),
    };
}

/**
 * Render a Pine `if`/`else if`/`else` statement as a chartlang
 * `if (...) { ... } else if (...) { ... } else { ... }` string. Each body is
 * rendered through `emitBody`. Returns `null` when every branch lowers to an
 * empty body (e.g. the `if` only mutated owned drawings, emitted elsewhere) so
 * the caller can drop the dead `if` rather than emit `if (…) {  }`.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { emitIf } from "./controlFlow.js";
 *     // emitIf(stmt, ctx, () => ["plot(bar.close);"])
 *     void emitIf;
 */
export function emitIf(stmt: IfStatement, ctx: EmitContext, emitBody: BodyEmitter): string | null {
    const thenBody = emitBody(stmt.thenBody.body, ctx).join(" ");
    const clauses = stmt.elseIfClauses.map((clause) => ({
        condition: emitWithContext(clause.condition, ctx),
        body: emitBody(clause.body.body, ctx).join(" "),
    }));
    const elseBody = stmt.elseBody === null ? null : emitBody(stmt.elseBody.body, ctx).join(" ");
    // The whole `if` is dead when every branch lowered to nothing (e.g. it
    // only mutated owned drawings, emitted elsewhere) — drop it rather than
    // emit `if (…) {  }`.
    if (thenBody === "" && clauses.every((c) => c.body === "") && (elseBody ?? "") === "") {
        return null;
    }
    const parts: string[] = [`if (${emitWithContext(stmt.condition, ctx)}) { ${thenBody} }`];
    for (const clause of clauses) {
        parts.push(`else if (${clause.condition}) { ${clause.body} }`);
    }
    if (elseBody !== null) {
        parts.push(`else { ${elseBody} }`);
    }
    return parts.join(" ");
}

// Whether any statement in a body (descending nested `if`/`for`/`switch`
// bodies) calls a stateful primitive — the unroll trigger.
function bodyHasStatefulPrimitive(statements: readonly Statement[]): boolean {
    return statements.some(statementHasStatefulPrimitive);
}

function statementHasStatefulPrimitive(stmt: Statement): boolean {
    switch (stmt.kind) {
        case "expression-statement":
            return expressionHasStatefulPrimitive(stmt.expression);
        case "variable-declaration":
            return expressionHasStatefulPrimitive(stmt.initializer);
        case "assignment":
            return expressionHasStatefulPrimitive(stmt.value);
        case "if-statement":
            return (
                bodyHasStatefulPrimitive(stmt.thenBody.body) ||
                stmt.elseIfClauses.some((clause) => bodyHasStatefulPrimitive(clause.body.body)) ||
                (stmt.elseBody !== null && bodyHasStatefulPrimitive(stmt.elseBody.body))
            );
        case "for-statement":
            return bodyHasStatefulPrimitive(stmt.body.body);
        case "switch-statement":
            return stmt.cases.some((arm) => bodyHasStatefulPrimitive(arm.body));
        case "block-statement":
            return bodyHasStatefulPrimitive(stmt.body);
        case "enum-declaration":
            return false;
        default:
            return false;
    }
}

// Whether any statement in a body contains a `break`/`continue` (descending
// nested `if`/`for`/`switch`/`block` bodies, mirroring
// `bodyHasStatefulPrimitive`'s shape). A SEPARATE signal from the stateful one:
// a `break`/`continue` FORCES the no-unroll / runtime-`for` path (unrolling
// cannot express `break`), which is the exact opposite of what a stateful body
// forces (an unroll). The two together are unconvertible (see `emitFor`).
function bodyHasBreakContinue(statements: readonly Statement[]): boolean {
    return statements.some(statementHasBreakContinue);
}

function statementHasBreakContinue(stmt: Statement): boolean {
    switch (stmt.kind) {
        case "break-statement":
        case "continue-statement":
            return true;
        case "if-statement":
            return (
                bodyHasBreakContinue(stmt.thenBody.body) ||
                stmt.elseIfClauses.some((clause) => bodyHasBreakContinue(clause.body.body)) ||
                (stmt.elseBody !== null && bodyHasBreakContinue(stmt.elseBody.body))
            );
        case "for-statement":
            return bodyHasBreakContinue(stmt.body.body);
        case "switch-statement":
            return stmt.cases.some((arm) => bodyHasBreakContinue(arm.body));
        case "block-statement":
            return bodyHasBreakContinue(stmt.body);
        case "enum-declaration":
            return false;
        default:
            return false;
    }
}

/**
 * Render a Pine `for i = a to b [by s]` loop. When the body calls a stateful
 * primitive (`plot`/`hline`/`alert`/`ta.*`/`draw.*`) the loop MUST be
 * unrolled (chartlang rejects a stateful call inside any loop): each iteration
 * is rendered with the iterator substituted by its concrete value. When the
 * body is non-stateful and the bounds are true literals, a runtime
 * `for (let i = a; i <= b; i += s)` is emitted. A non-stateful body whose
 * bound is an `input.int` default unrolls too (a runtime loop with a
 * non-literal bound is rejected by chartlang). A stateful body whose bounds
 * are non-resolvable pushes `loop-bounds-not-literal-for-stateful-body` and
 * emits nothing; a non-stateful non-resolvable bound pushes
 * `loop-bounds-not-literal-for-stateful-body` as well (chartlang forbids the
 * non-literal runtime bound).
 *
 * A body containing `break`/`continue` overrides the unroll heuristic and is
 * ALWAYS emitted as a runtime `for` (a `break` cannot span unrolled
 * iterations); its bound is resolved through `resolveBound` (literal OR frozen
 * `input.int` default). Such a body cannot also hold a stateful primitive
 * (chartlang forbids one in any loop) — that combination pushes
 * `stateful-loop-with-break` and emits nothing; a non-resolvable break-loop
 * bound pushes `loop-bounds-not-literal-for-stateful-body`.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { emitFor } from "./controlFlow.js";
 *     // emitFor(stmt, ctx, diagnostics, () => null, () => [...])
 *     void emitFor;
 */
export function emitFor(
    stmt: ForStatement,
    ctx: EmitContext,
    diagnostics: DiagnosticCollector,
    inputDefault: (name: string) => number | null,
    emitBody: BodyEmitter,
    inputMax: (name: string) => number | null = () => null,
): readonly string[] {
    const stateful = bodyHasStatefulPrimitive(stmt.body.body);
    const breaks = bodyHasBreakContinue(stmt.body.body);
    const from = resolveBound(stmt.from, inputDefault);
    const to = resolveBound(stmt.to, inputDefault);
    const step =
        stmt.step === null
            ? { value: 1, fromInputDefault: false }
            : resolveBound(stmt.step, inputDefault);
    const resolvable = from !== null && to !== null && step !== null && step.value !== 0;

    if (breaks) {
        // A `break`/`continue` loop can be neither unrolled (a `break` cannot
        // span unrolled iterations) nor hold a stateful call (chartlang forbids
        // a stateful primitive in any loop). A stateful break-loop is therefore
        // unconvertible; otherwise emit a runtime `for` with the
        // `break`/`continue` lowered inside it.
        if (stateful) {
            diagnostics.pushCode("stateful-loop-with-break", stmt.span);
            return [];
        }
        if (!resolvable) {
            diagnostics.pushCode("loop-bounds-not-literal-for-stateful-body", stmt.span);
            return [];
        }
        return emitRuntimeForFromBounds(stmt, from, to, step, ctx, diagnostics, emitBody);
    }

    if (!stateful) {
        if (resolvable) {
            const inputLoop = emitInputBoundLoop(
                stmt,
                from,
                to,
                step,
                ctx,
                diagnostics,
                emitBody,
                inputMax,
            );
            if (inputLoop !== null) return inputLoop;
        }
        const literalLoop = emitLiteralLoop(stmt, ctx, emitBody);
        if (literalLoop !== null) {
            // A loop whose body lowered to nothing (e.g. it only built an
            // owned drawing collection, emitted elsewhere) is dead — drop it
            // rather than emit `for (…) {  }`.
            return literalLoop.body === "" ? [] : [`${literalLoop.header} { ${literalLoop.body} }`];
        }
    }
    if (!resolvable) {
        diagnostics.pushCode("loop-bounds-not-literal-for-stateful-body", stmt.span);
        return [];
    }
    return unroll(stmt, from, to, step, ctx, diagnostics, stateful, emitBody);
}

// The `for (let i = a; i <= b; i += s)` header for resolved integer bounds.
// Pine auto-counts down when `from > to`; the `by` value contributes only its
// magnitude (direction is the from-vs-to relation), so a descending loop emits
// `>=` / `--` / `-= mag` to run its iterations.
function forHeader(variable: string, from: number, to: number, step: number): string {
    const ascending = from <= to;
    const magnitude = Math.abs(step);
    const comparison = ascending ? "<=" : ">=";
    const update =
        magnitude === 1
            ? `${variable}${ascending ? "++" : "--"}`
            : `${variable} += ${ascending ? magnitude : -magnitude}`;
    return `for (let ${variable} = ${from}; ${variable} ${comparison} ${to}; ${update})`;
}

function emitInputBoundLoop(
    stmt: ForStatement,
    from: ResolvedBound,
    to: ResolvedBound,
    step: ResolvedBound,
    ctx: EmitContext,
    diagnostics: DiagnosticCollector,
    emitBody: BodyEmitter,
    inputMax: (name: string) => number | null,
): readonly string[] | null {
    if (!to.fromInputDefault || from.fromInputDefault || step.fromInputDefault) return null;
    // The input-bound runtime loop only emits an ASCENDING header
    // (`i <= inputs.x; i++`), so it is sound only when the loop counts up. When
    // the literal from-bound exceeds the input's DEFAULT, Pine would auto-count
    // DOWN — fall back to the unroll-at-default path (which renders the real
    // direction via the from-vs-to relation) rather than emit a permanently
    // false ascending loop that silently runs zero iterations.
    if (from.value > to.value) return null;
    const toName = to.inputName;
    /* v8 ignore next */
    if (toName === undefined) return null;
    if (inputMax(toName) === null) {
        diagnostics.pushCode("loop-bound-input-unbounded", stmt.span);
    }
    const magnitude = Math.abs(step.value);
    const update = magnitude === 1 ? `${stmt.variable}++` : `${stmt.variable} += ${magnitude}`;
    const header = `for (let ${stmt.variable} = ${from.value}; ${stmt.variable} <= (inputs.${toName} as number); ${update})`;
    const body = emitBody(stmt.body.body, loopChildContext(ctx, stmt.variable)).join(" ");
    return body === "" ? [] : [`${header} { ${body} }`];
}

// The runtime `for (let i = a; i <= b; i += s)` header + rendered body for a
// loop whose bounds (and step) are TRUE integer literals (not input defaults),
// or `null` so the caller falls back to unrolling. The body is split out so
// the caller can drop a loop that lowered to an empty body.
function emitLiteralLoop(
    stmt: ForStatement,
    ctx: EmitContext,
    emitBody: BodyEmitter,
): { readonly header: string; readonly body: string } | null {
    const from = literalInt(stmt.from);
    const to = literalInt(stmt.to);
    const step = stmt.step === null ? 1 : literalInt(stmt.step);
    if (from === null || to === null || step === null || step === 0) {
        return null;
    }
    return {
        header: forHeader(stmt.variable, from, to, step),
        body: emitBody(stmt.body.body, loopChildContext(ctx, stmt.variable)).join(" "),
    };
}

// Emit a runtime `for` from RESOLVED integer bounds (literal OR `input.int`
// default), used by the `break`/`continue` path where unrolling is impossible.
// An `input.int`-derived bound keeps the established
// `loop-unroll-frozen-at-input-default` semantics: the frozen default is inlined
// as the literal bound (chartlang forbids a non-literal runtime bound), and the
// info is raised so the author knows the count will not follow the input.
function emitRuntimeForFromBounds(
    stmt: ForStatement,
    from: ResolvedBound,
    to: ResolvedBound,
    step: ResolvedBound,
    ctx: EmitContext,
    diagnostics: DiagnosticCollector,
    emitBody: BodyEmitter,
): readonly string[] {
    if (from.fromInputDefault || to.fromInputDefault || step.fromInputDefault) {
        diagnostics.pushCode("loop-unroll-frozen-at-input-default", stmt.span);
    }
    const header = forHeader(stmt.variable, from.value, to.value, step.value);
    const body = emitBody(stmt.body.body, loopChildContext(ctx, stmt.variable)).join(" ");
    return [`${header} { ${body} }`];
}

// Unroll a resolvable-bounds loop into one rendered body per iteration with
// the iterator substituted, plus the once-per-loop info diagnostics.
function unroll(
    stmt: ForStatement,
    from: ResolvedBound,
    to: ResolvedBound,
    step: ResolvedBound,
    ctx: EmitContext,
    diagnostics: DiagnosticCollector,
    stateful: boolean,
    emitBody: BodyEmitter,
): readonly string[] {
    if (stateful) {
        diagnostics.pushCode("loop-body-unrolled", stmt.span);
    }
    if (from.fromInputDefault || to.fromInputDefault || step.fromInputDefault) {
        diagnostics.pushCode("loop-unroll-frozen-at-input-default", stmt.span);
    }
    const out: string[] = [];
    // Direction is the from-vs-to relation; `by` contributes only magnitude.
    const ascending = from.value <= to.value;
    const magnitude = Math.abs(step.value);
    const stepDelta = ascending ? magnitude : -magnitude;
    for (let i = from.value; ascending ? i <= to.value : i >= to.value; i += stepDelta) {
        const substituted = stmt.body.body.map((inner) =>
            substituteStatement(inner, stmt.variable, i),
        );
        out.push(...emitBody(substituted, ctx));
    }
    return out;
}

// The child context for an emitted `for` body: the loop-iterator local is
// added (so the body never rewrites the iterator name to `inputs.<name>` / a
// state slot) and `inLoop` is set (so a `break`/`continue` in the body lowers
// to a JS jump rather than raising `break-continue-outside-loop`).
function loopChildContext(ctx: EmitContext, name: string): EmitContext {
    return { ...ctx, localNames: new Set([...ctx.localNames, name]), inLoop: true };
}

/**
 * Render a Pine `switch`. With a subject, each `case` becomes
 * `case <test>: <body> break;` and the default `=> …` arm becomes
 * `default:`. Without a subject (Pine's boolean-case form), the cases lower
 * to an `if`/`else if`/`else` chain where each `test` is the branch
 * condition. The cases' bodies are rendered through `emitBody`.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { emitSwitch } from "./controlFlow.js";
 *     // emitSwitch(stmt, ctx, () => ["plot(bar.close);"])
 *     void emitSwitch;
 */
export function emitSwitch(stmt: SwitchStatement, ctx: EmitContext, emitBody: BodyEmitter): string {
    if (stmt.subject === null) {
        return emitSubjectlessSwitch(stmt, ctx, emitBody);
    }
    const subject = emitWithContext(stmt.subject, ctx);
    const arms: string[] = [];
    for (const arm of stmt.cases) {
        const body = emitBody(arm.body, ctx).join(" ");
        if (arm.test === null) {
            arms.push(`default: { ${body} break; }`);
        } else {
            arms.push(`case ${emitWithContext(arm.test, ctx)}: { ${body} break; }`);
        }
    }
    return `switch (${subject}) { ${arms.join(" ")} }`;
}

function emitSubjectlessSwitch(
    stmt: SwitchStatement,
    ctx: EmitContext,
    emitBody: BodyEmitter,
): string {
    const parts: string[] = [];
    let conditionalCount = 0;
    for (const arm of stmt.cases) {
        const body = emitBody(arm.body, ctx).join(" ");
        if (arm.test === null) {
            // A default arm after conditionals is an `else`; a lone default
            // (no preceding `case` test) renders unconditionally.
            parts.push(conditionalCount === 0 ? `{ ${body} }` : `else { ${body} }`);
            continue;
        }
        const keyword = conditionalCount === 0 ? "if" : "else if";
        parts.push(`${keyword} (${emitWithContext(arm.test, ctx)}) { ${body} }`);
        conditionalCount += 1;
    }
    return parts.join(" ");
}
