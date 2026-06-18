// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CallExpression, ExpressionNode } from "../ast/index.js";
import { dottedCallee } from "./callArgs.js";
import type { AnnotationLookup } from "./exprEmit.js";
import { emitExpr } from "./exprEmit.js";

/**
 * The outcome of mapping a Pine `array.*` read builtin onto a chartlang ring
 * accessor: either the lowered `source` string, or a `reject` with the
 * diagnostic code the caller raises at the call's span. `null` (the function
 * return) marks a call that is not a ring-mappable `array.*` read.
 *
 * @since 0.1
 * @stable
 * @example
 *     const r: ArrayBuiltinResult = { kind: "source", source: "__lvls_ring.at(0)" };
 *     void r;
 */
export type ArrayBuiltinResult =
    | Readonly<{ kind: "source"; source: string }>
    | Readonly<{ kind: "reject"; code: "negative-array-index" }>;

// A literal/unary-literal integer value (`5`, `-1`), or `null` when the
// index is a non-literal expression (`i`, `n - 1`).
function literalIntIndex(expr: ExpressionNode): number | null {
    if (expr.kind === "literal-expression" && expr.literalKind === "int") {
        return Number.parseInt(expr.value, 10);
    }
    if (
        expr.kind === "unary-expression" &&
        (expr.operator === "-" || expr.operator === "+") &&
        expr.operand.kind === "literal-expression" &&
        expr.operand.literalKind === "int"
    ) {
        const magnitude = Number.parseInt(expr.operand.value, 10);
        return expr.operator === "-" ? -magnitude : magnitude;
    }
    return null;
}

/**
 * Map a Pine `array.*` READ builtin against a registered ring local onto the
 * chartlang ring accessor source:
 *
 * - `array.first(coll)` → `<ring>.at(0)` (oldest still in the ring).
 * - `array.last(coll)` → `<ring>.at(<ring>.size() - 1)` (newest).
 * - `array.size(coll)` → `<ring>.size()`.
 * - `array.get(coll, i)` → `<ring>.at(<i>)`; a literal negative index
 *   REJECTs with `negative-array-index` (Pine permits it, the ring does not).
 *
 * Returns `null` for any other callee (including the write builtins
 * `array.push`/`array.shift`, which the Camp B transform lowers directly —
 * push to the fixed ring callsite, shift elided). The index expression of
 * `array.get` lowers through {@link emitExpr} so a loop iterator (`i`) passes
 * through verbatim.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { mapArrayBuiltin } from "./arrayBuiltinMap.js";
 *     declare const call: import("../ast/index.js").CallExpression;
 *     mapArrayBuiltin(call, "__lvls_ring", new Map());
 */
export function mapArrayBuiltin(
    call: CallExpression,
    ringLocal: string,
    annotations: AnnotationLookup,
): ArrayBuiltinResult | null {
    const name = dottedCallee(call);
    if (name === "array.first") {
        return { kind: "source", source: `${ringLocal}.at(0)` };
    }
    if (name === "array.last") {
        return { kind: "source", source: `${ringLocal}.at(${ringLocal}.size() - 1)` };
    }
    if (name === "array.size") {
        return { kind: "source", source: `${ringLocal}.size()` };
    }
    if (name === "array.get") {
        const indexArg = call.args[1];
        if (indexArg === undefined) {
            return null;
        }
        const literal = literalIntIndex(indexArg.value);
        if (literal !== null && literal < 0) {
            return { kind: "reject", code: "negative-array-index" };
        }
        return {
            kind: "source",
            source: `${ringLocal}.at(${emitExpr(indexArg.value, annotations)})`,
        };
    }
    return null;
}
