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
 * @experimental
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
 * @experimental
 * @example
 *     const b: ResolvedBound = { value: 9, fromInputDefault: true };
 *     void b;
 */
export type ResolvedBound = Readonly<{ value: number; fromInputDefault: boolean }>;

/**
 * Resolve a `for` bound expression to a compile-time integer. A literal /
 * unary-literal resolves directly; a bare identifier naming a registered
 * input resolves to that input's recorded literal default via `inputDefault`.
 * Returns `null` when the bound is a runtime expression.
 *
 * @since 0.1
 * @experimental
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
            return { value: fromInput, fromInputDefault: true };
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
 * @experimental
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
            return {
                ...node,
                elements: node.elements.map((el) => substituteIterator(el, variable, value)),
            };
        case "lambda-expression":
            return { ...node, body: substituteIterator(node.body, variable, value) };
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
 * Render a Pine `if`/`else if`/`else` statement as a chartlang
 * `if (...) { ... } else if (...) { ... } else { ... }` string. Each body is
 * rendered through `emitBody`; an empty branch still emits its braces so the
 * structure round-trips.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { emitIf } from "./controlFlow.js";
 *     // emitIf(stmt, ctx, () => ["plot(bar.close);"])
 *     void emitIf;
 */
export function emitIf(stmt: IfStatement, ctx: EmitContext, emitBody: BodyEmitter): string {
    const parts: string[] = [
        `if (${emitWithContext(stmt.condition, ctx)}) { ${emitBody(stmt.thenBody.body, ctx).join(" ")} }`,
    ];
    for (const clause of stmt.elseIfClauses) {
        parts.push(
            `else if (${emitWithContext(clause.condition, ctx)}) { ${emitBody(clause.body.body, ctx).join(" ")} }`,
        );
    }
    if (stmt.elseBody !== null) {
        parts.push(`else { ${emitBody(stmt.elseBody.body, ctx).join(" ")} }`);
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
 * @since 0.1
 * @experimental
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
): readonly string[] {
    const stateful = bodyHasStatefulPrimitive(stmt.body.body);
    const from = resolveBound(stmt.from, inputDefault);
    const to = resolveBound(stmt.to, inputDefault);
    const step =
        stmt.step === null
            ? { value: 1, fromInputDefault: false }
            : resolveBound(stmt.step, inputDefault);
    const resolvable = from !== null && to !== null && step !== null && step.value !== 0;

    if (!stateful) {
        const literalLoop = emitLiteralLoop(stmt, ctx, emitBody);
        if (literalLoop !== null) {
            return [literalLoop];
        }
    }
    if (!resolvable) {
        diagnostics.pushCode("loop-bounds-not-literal-for-stateful-body", stmt.span);
        return [];
    }
    return unroll(stmt, from, to, step, ctx, diagnostics, stateful, emitBody);
}

// A runtime `for (let i = a; i <= b; i += s)` when BOTH bounds (and the step)
// are TRUE integer literals (not input defaults), else `null` so the caller
// falls back to unrolling.
function emitLiteralLoop(
    stmt: ForStatement,
    ctx: EmitContext,
    emitBody: BodyEmitter,
): string | null {
    const from = literalInt(stmt.from);
    const to = literalInt(stmt.to);
    const step = stmt.step === null ? 1 : literalInt(stmt.step);
    if (from === null || to === null || step === null || step === 0) {
        return null;
    }
    const variable = stmt.variable;
    // Pine auto-counts down when `from > to`; the `by` value contributes only
    // its magnitude (direction is the from-vs-to relation), so a descending
    // loop must emit `>=` / `--` / `-= mag` to run its iterations.
    const ascending = from <= to;
    const magnitude = Math.abs(step);
    const comparison = ascending ? "<=" : ">=";
    const update =
        magnitude === 1
            ? `${variable}${ascending ? "++" : "--"}`
            : `${variable} += ${ascending ? magnitude : -magnitude}`;
    const childCtx = withLocal(ctx, variable);
    return `for (let ${variable} = ${from}; ${variable} ${comparison} ${to}; ${update}) { ${emitBody(stmt.body.body, childCtx).join(" ")} }`;
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

// Add a loop-iterator local to the context so a `for` body never rewrites the
// iterator name to `inputs.<name>` / a state slot.
function withLocal(ctx: EmitContext, name: string): EmitContext {
    return { ...ctx, localNames: new Set([...ctx.localNames, name]) };
}

/**
 * Render a Pine `switch`. With a subject, each `case` becomes
 * `case <test>: <body> break;` and the default `=> …` arm becomes
 * `default:`. Without a subject (Pine's boolean-case form), the cases lower
 * to an `if`/`else if`/`else` chain where each `test` is the branch
 * condition. The cases' bodies are rendered through `emitBody`.
 *
 * @since 0.1
 * @experimental
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
