// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CallExpression, ExpressionNode } from "../ast/index.js";
import type { Statement, VariableDeclaration } from "../ast/statements.js";
import type { SourceSpan } from "../index.js";
import type { SemanticResult } from "../semantic/index.js";
import { dottedCallee } from "./callArgs.js";

// The literal integer value of an expression (`20`, `+20`, `-20`), or `null`.
// A negative magnitude is returned as-is so the caller can reject a non-positive
// cap.
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

// Whether a declaration's initializer is an `array.new(...)` constructor — the
// load-bearing discriminator that separates a numeric-array `var` from a scalar
// `var` (the parser collapses `array<float>` to a `float` annotation, so the
// annotation alone cannot tell them apart). The `<T>` type arg is dropped by the
// parser; the element type is read from the `var array<T>` annotation.
function isArrayNew(value: ExpressionNode): value is CallExpression {
    return value.kind === "call-expression" && dottedCallee(value) === "array.new";
}

// Whether an `array.new(...)` array's element type is numeric. The `var
// array<T>` annotation collapses to a `named-type` whose name is the ELEMENT
// type (`float`/`int` = numeric; `bool`/`string`/`color` = non-numeric). A null
// annotation defaults to numeric — `array.new<T>` always names a `T` in real
// Pine, and numeric is the dominant case (the same default-numeric precedent as
// the scalar `var` → `state.series` lowering).
function isNumericElement(decl: VariableDeclaration): boolean {
    const annotation = decl.typeAnnotation;
    if (annotation === null || annotation.kind !== "named-type") {
        return true;
    }
    return annotation.name === "int" || annotation.name === "float";
}

// A bounded numeric `var array` slot: the source declaration plus the detected
// literal capacity `K`.
type NumericArraySlot = Readonly<{ decl: VariableDeclaration; cap: number }>;

/**
 * The numeric-array classification of a script's top-level `var`/`varip`
 * `array.new(...)` declarations, partitioned three ways:
 *
 * - `slots` — bounded numeric arrays (a detectable literal capacity `K`); each
 *   lowers to `const <name> = state.array<number>(K)`.
 * - `nonNumeric` — `array<bool|string|color>` (or UDT) collections; each keeps
 *   its current (non-lowered) behavior + an `array-collection-non-numeric` info.
 *   Maps the Pine name to the decl span the info anchors at.
 * - `unbounded` — numeric arrays with NO detectable cap; each hard-rejects
 *   `unbounded-array-collection` (chartlang has no unbounded collection). Maps
 *   the Pine name to the decl span the reject anchors at.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { scanNumericArrays } from "./numericArray.js";
 *     declare const analysis: import("../semantic/index.js").SemanticResult;
 *     const scan = scanNumericArrays(analysis, new Set());
 *     scan.slots.size; // number of bounded numeric arrays
 */
export type NumericArrayScan = Readonly<{
    slots: ReadonlyMap<string, NumericArraySlot>;
    nonNumeric: ReadonlyMap<string, SourceSpan>;
    unbounded: ReadonlyMap<string, SourceSpan>;
}>;

// The collection name of an `array.size(coll) >|>= K` eviction guard whose body
// only `*.delete(...)`s an `array.shift|remove(coll)` / bare `array.shift|remove
// (coll)`, plus the literal cap `K`, or `null`. A numeric ring's eviction has NO
// handle to `*.delete`, so the body is a bare `array.shift(coll)` /
// `array.remove(coll)` line — but a numeric collection sharing a script with
// handle rings might still wrap it, so both forms are accepted.
function evictionCap(
    stmt: Statement,
): { readonly collection: string; readonly cap: number } | null {
    if (stmt.kind !== "if-statement" || stmt.elseBody !== null || stmt.elseIfClauses.length > 0) {
        return null;
    }
    const condition = stmt.condition;
    if (
        condition.kind !== "binary-expression" ||
        (condition.operator !== ">" && condition.operator !== ">=") ||
        condition.left.kind !== "call-expression" ||
        dottedCallee(condition.left) !== "array.size"
    ) {
        return null;
    }
    const target = condition.left.args[0]?.value;
    if (target === undefined || target.kind !== "identifier-expression") {
        return null;
    }
    const cap = literalInt(condition.right);
    if (cap === null) {
        return null;
    }
    return everyStatementEvicts(stmt.thenBody.body, target.name)
        ? { collection: target.name, cap }
        : null;
}

// Whether every statement in an eviction-guard body removes the head of the
// collection (`array.shift(coll)` / `array.remove(coll, 0)` / a `*.delete(...)`
// wrapping one of those).
function everyStatementEvicts(body: readonly Statement[], collection: string): boolean {
    return body.length > 0 && body.every((inner) => isEvictionStatement(inner, collection));
}

// Whether a statement is a numeric ring's head-removal eviction: a bare
// `array.shift(coll)` / `array.remove(coll, …)` line. A numeric ring has no
// handle to `*.delete`, so the wrapped-delete form (the handle-ring eviction) is
// not part of the numeric signature.
function isEvictionStatement(stmt: Statement, collection: string): boolean {
    if (stmt.kind !== "expression-statement" || stmt.expression.kind !== "call-expression") {
        return false;
    }
    const name = dottedCallee(stmt.expression);
    if (name !== "array.shift" && name !== "array.remove") {
        return false;
    }
    const arg = stmt.expression.args[0]?.value;
    return arg !== undefined && arg.kind === "identifier-expression" && arg.name === collection;
}

// The capacity of a numeric array, in priority order: the eviction-guard cap
// (`if array.size(coll) > K`), then the `array.new<float>(K)` literal size arg.
// `null` ⇒ no detectable cap (an unbounded array — a hard reject). A non-positive
// resolved cap is treated as no cap (also unbounded — chartlang has no zero-cap
// ring).
function resolveCap(decl: VariableDeclaration, body: readonly Statement[]): number | null {
    for (const stmt of body) {
        const guard = evictionCap(stmt);
        if (guard !== null && guard.collection === decl.name) {
            return guard.cap > 0 ? guard.cap : null;
        }
    }
    if (isArrayNew(decl.initializer)) {
        const sizeArg = decl.initializer.args.find((arg) => arg.name === null)?.value;
        if (sizeArg !== undefined) {
            const cap = literalInt(sizeArg);
            return cap !== null && cap > 0 ? cap : null;
        }
    }
    return null;
}

/**
 * Classify a script's top-level `var`/`varip` numeric-array declarations into
 * the {@link NumericArrayScan} partitions. Only ROOT-level `array.new(...)`
 * declarations the drawing transforms do NOT already own are considered (a
 * handle ring, e.g. `var array<line>`, is a drawing site and is filtered out via
 * `owned`); a non-numeric element type routes to `nonNumeric`; a numeric array
 * with a detectable literal cap routes to `slots`, else to `unbounded`.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { lex } from "../lexer/index.js";
 *     import { parseStatements } from "../parser/index.js";
 *     import { analyze } from "../semantic/index.js";
 *     import { scanNumericArrays } from "./numericArray.js";
 *     const src =
 *         '//@version=6\nindicator("X")\n' +
 *         "var array<float> win = array.new<float>()\n" +
 *         "array.push(win, close)\n" +
 *         "if array.size(win) > 20\n    array.shift(win)\n";
 *     const analysis = analyze(parseStatements(lex(src).tokens).script);
 *     const scan = scanNumericArrays(analysis, new Set());
 *     scan.slots.get("win")?.cap; // 20
 */
export function scanNumericArrays(
    analysis: SemanticResult,
    owned: ReadonlySet<string>,
): NumericArrayScan {
    const slots = new Map<string, NumericArraySlot>();
    const nonNumeric = new Map<string, SourceSpan>();
    const unbounded = new Map<string, SourceSpan>();
    for (const stmt of analysis.script.body) {
        if (
            stmt.kind !== "variable-declaration" ||
            (stmt.qualifier !== "var" && stmt.qualifier !== "varip") ||
            owned.has(stmt.name) ||
            !isArrayNew(stmt.initializer)
        ) {
            continue;
        }
        if (!isNumericElement(stmt)) {
            nonNumeric.set(stmt.name, stmt.span);
            continue;
        }
        const cap = resolveCap(stmt, analysis.script.body);
        if (cap === null) {
            unbounded.set(stmt.name, stmt.span);
            continue;
        }
        slots.set(stmt.name, { decl: stmt, cap });
    }
    return { slots, nonNumeric, unbounded };
}
