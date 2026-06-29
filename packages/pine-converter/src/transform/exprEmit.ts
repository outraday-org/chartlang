// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ExpressionNode, HistoryAccessExpression, SwitchExpression } from "../ast/index.js";
import { PINE_NA_COLOR, lowerBuiltinCall, remapIdentifier } from "../mapping/index.js";
import type { AstNode, SemanticAnnotation } from "../semantic/index.js";

/**
 * Per-node semantic facts the emitter consults — currently just the
 * `naKind` flavour resolved during semantic analysis. Keyed by AST node
 * identity (a `ReadonlyMap`), exactly the shape `SemanticResult.annotations`
 * carries.
 *
 * @since 0.1
 * @stable
 * @example
 *     const ann: AnnotationLookup = new Map();
 *     void ann;
 */
export type AnnotationLookup = ReadonlyMap<AstNode, SemanticAnnotation>;

// Pine logical-keyword → chartlang operator.
const LOGICAL_OPERATORS: ReadonlyMap<string, string> = new Map([
    ["and", "&&"],
    ["or", "||"],
]);

// A literal / identifier / call / member / history node needs no wrapping
// parens when it appears as an operand; compound operator forms do.
function isAtomic(node: ExpressionNode): boolean {
    return (
        node.kind === "identifier-expression" ||
        node.kind === "literal-expression" ||
        node.kind === "na-expression" ||
        node.kind === "call-expression" ||
        node.kind === "member-access-expression" ||
        node.kind === "history-access-expression" ||
        node.kind === "paren-expression"
    );
}

// Wrap a non-atomic emitted operand so the (loose, precedence-blind) string
// concatenation never changes meaning. The chartlang typechecker tolerates
// the redundant parens.
function operand(node: ExpressionNode, annotations: AnnotationLookup): string {
    const emitted = emitExpr(node, annotations);
    return isAtomic(node) ? emitted : `(${emitted})`;
}

function emitColorLiteral(value: string): string {
    // Color literals (`#ff0000`) become quoted chartlang strings.
    return JSON.stringify(value);
}

function emitNa(node: ExpressionNode, annotations: AnnotationLookup): string {
    // `na` is the drawing-handle `null` sentinel in a handle context, the
    // transparent CSS string in a `var color` context (the runtime synthesizes
    // no color default), else the numeric `Number.NaN` sentinel.
    const naKind = annotations.get(node)?.naKind;
    if (naKind === "handle") {
        return "null";
    }
    if (naKind === "color") {
        return JSON.stringify(PINE_NA_COLOR);
    }
    return "Number.NaN";
}

function emitMemberChain(chain: readonly string[], headExpr: string | null): string {
    const tail = chain.join(".");
    return headExpr === null ? tail : `${headExpr}.${tail}`;
}

// Lower a value-form `switch` to a right-nested ternary chain matching Pine: an
// arm with a `test` becomes `<cond> ? <value> : <rest>` (with a subject the
// condition is `<subject> === <label>`; the subject-less boolean form uses the
// test directly), a default arm (`test === null`) becomes the unconditional
// `<rest>`, and an exhausted chain yields `Number.NaN` (Pine returns `na` when
// nothing matches and there is no default). Building right-to-left nests the
// ternary correctly without extra parentheses (ternary is right-associative);
// `operand` self-parenthesises any non-atomic sub-expression.
function emitSwitchExpression(node: SwitchExpression, annotations: AnnotationLookup): string {
    let chain = "Number.NaN";
    for (let i = node.cases.length - 1; i >= 0; i -= 1) {
        const arm = node.cases[i];
        const value = operand(arm.value, annotations);
        if (arm.test === null) {
            chain = value;
            continue;
        }
        const condition =
            node.subject === null
                ? operand(arm.test, annotations)
                : `${operand(node.subject, annotations)} === ${operand(arm.test, annotations)}`;
        chain = `${condition} ? ${value} : ${chain}`;
    }
    return chain;
}

// The widening base TS type for a LITERAL operand, or null if the node is not
// a literal whose double-literal equality would trip TS2367 (`color`/`na`
// literals and non-literals are excluded — they never produce a no-overlap
// equality of the inlined-literal form this guards).
function literalBaseType(node: ExpressionNode): "string" | "number" | "boolean" | null {
    if (node.kind !== "literal-expression") {
        return null;
    }
    switch (node.literalKind) {
        case "string":
            return "string";
        case "int":
        case "float":
            return "number";
        case "bool":
            return "boolean";
        default:
            return null;
    }
}

/**
 * Lower a Pine v6 {@link ExpressionNode} to a chartlang TypeScript
 * expression string. OHLCV / `time` / `bar_index` identifiers are remapped
 * via {@link remapIdentifier}; `and`/`or`/`not` become `&&`/`||`/`!`; `na`
 * resolves to `null` or `Number.NaN` from its `naKind` annotation. Compound
 * operator forms self-parenthesise so the output is always re-parseable
 * regardless of precedence.
 *
 * The output is a templating primitive for Task 16's codegen — it is the
 * verbatim source the emitter splices into the generated `.chart.ts`.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { emitExpr } from "./exprEmit.js";
 *     const node = {
 *         kind: "identifier-expression",
 *         name: "close",
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 6 },
 *     } as const;
 *     emitExpr(node, new Map()); // "bar.close"
 */
export function emitExpr(node: ExpressionNode, annotations: AnnotationLookup): string {
    switch (node.kind) {
        case "identifier-expression":
            return remapIdentifier(node.name) ?? node.name;
        case "literal-expression":
            return node.literalKind === "color" ? emitColorLiteral(node.value) : node.value;
        case "na-expression":
            return emitNa(node, annotations);
        case "unary-expression": {
            const op = node.operator === "not" ? "!" : node.operator;
            return `${op}${operand(node.operand, annotations)}`;
        }
        case "binary-expression": {
            const op = LOGICAL_OPERATORS.get(node.operator) ?? node.operator;
            const left = operand(node.left, annotations);
            const right = operand(node.right, annotations);
            // A stateful UDF inlined by `udfInline.ts` can substitute a string /
            // numeric LITERAL argument into an equality test, leaving literal
            // operands on BOTH sides (`"EMA" == "HMA"`). Under strict TS that is
            // a TS2367 "no overlap" error even though it is a harmless,
            // always-false test. Widen the left literal to its base TS type —
            // the same `as`-cast precedent as `(inputs.x as string)` — so the
            // comparison type-checks. Gated to equality ops where BOTH operands
            // are literals sharing a base type, so a legitimately-typed mismatch
            // never has a NEW error masked.
            const leftBase = literalBaseType(node.left);
            if (
                (node.operator === "==" || node.operator === "!=") &&
                leftBase !== null &&
                leftBase === literalBaseType(node.right)
            ) {
                return `(${left} as ${leftBase}) ${op} ${right}`;
            }
            return `${left} ${op} ${right}`;
        }
        case "ternary-expression":
            return (
                `${operand(node.condition, annotations)} ? ` +
                `${operand(node.consequent, annotations)} : ` +
                `${operand(node.alternate, annotations)}`
            );
        case "call-expression": {
            // `na(x)` is the Pine "is missing" test, NOT a call of the `na`
            // sentinel. Lower it to a real predicate: a handle context tests
            // `=== null`, a numeric context tests `!Number.isFinite(...)`
            // (true for NaN / null / undefined). Without this the callee `na`
            // lowers to the `Number.NaN` value and emits `Number.NaN(x)`.
            if (node.callee.kind === "na-expression") {
                const first = node.args[0];
                if (first !== undefined) {
                    const arg = emitExpr(first.value, annotations);
                    return annotations.get(node.callee)?.naKind === "handle"
                        ? `(${arg} === null)`
                        : `!Number.isFinite(${arg})`;
                }
            }
            const emittedArgs = node.args.map((arg) => emitExpr(arg.value, annotations));
            // A bare-rooted calendar built-in call (`time()`, `time_close()`,
            // `dayofweek(t)`) lowers via the call-form table BEFORE the generic
            // path — its callee would otherwise remap as a value fragment
            // (`dayofweek` → `time.dayofweek(bar.time)`, `time` → `bar.time`)
            // and compose into `time.dayofweek(bar.time)(t)` / `bar.time()`.
            if (node.callee.kind === "identifier-expression") {
                const lowered = lowerBuiltinCall(node.callee.name, emittedArgs);
                if (lowered !== null) return lowered;
                // Pine's overloaded `nz(x[, replacement])` is a NaN-coalesce.
                // chartlang separates the scalar form (`math.nz`) from the
                // series form (`ta.nz`); v1 routes every `nz` to the scalar
                // `math.nz` (the common case — an intermediate scalar). A
                // series argument is the rarer case the author hand-edits to
                // `ta.nz`; the advisory `nz-scalar-assumed` info is raised at
                // the top-level call site (`emitSpecialCall` in `other.ts`),
                // where the diagnostic collector is in scope.
                if (node.callee.name === "nz" && emittedArgs.length > 0) {
                    return `math.nz(${emittedArgs.join(", ")})`;
                }
            }
            const callee = emitExpr(node.callee, annotations);
            return `${callee}(${emittedArgs.join(", ")})`;
        }
        case "member-access-expression":
            return emitMemberChain(
                node.chain,
                node.head === null ? null : operand(node.head, annotations),
            );
        case "history-access-expression":
            return `${operand(node.receiver, annotations)}[${emitExpr(node.offset, annotations)}]`;
        case "paren-expression":
            return `(${emitExpr(node.expression, annotations)})`;
        case "tuple-expression":
        case "array-literal-expression":
            return `[${node.elements.map((el) => emitExpr(el, annotations)).join(", ")}]`;
        case "lambda-expression":
            return `(${node.params.join(", ")}) => ${operand(node.body, annotations)}`;
        case "switch-expression":
            return emitSwitchExpression(node, annotations);
        case "unknown-expression":
            // Unrecoverable parser fallback; never reaches a real coordinate
            // arg. Emit a benign placeholder so the output still parses.
            return "undefined";
    }
}

/**
 * Visit every {@link HistoryAccessExpression} (`receiver[offset]`) reachable
 * inside an expression tree, in pre-order. Used by the `var` → `state.series`
 * lowering to find every `x[n]` history read of a scalar slot (so a numeric
 * `var` indexed anywhere lowers to a series), and to flag a non-literal offset.
 * Pure traversal — descends every child expression slot and never mutates.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { forEachHistoryAccess } from "./exprEmit.js";
 *     const node = {
 *         kind: "history-access-expression",
 *         receiver: {
 *             kind: "identifier-expression",
 *             name: "prev",
 *             span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 5 },
 *         },
 *         offset: {
 *             kind: "literal-expression",
 *             literalKind: "int",
 *             value: "1",
 *             span: { startLine: 1, startColumn: 6, endLine: 1, endColumn: 7 },
 *         },
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 8 },
 *     } as const;
 *     const names: string[] = [];
 *     forEachHistoryAccess(node, (h) => {
 *         if (h.receiver.kind === "identifier-expression") names.push(h.receiver.name);
 *     });
 *     // names === ["prev"]
 */
export function forEachHistoryAccess(
    node: ExpressionNode,
    visit: (history: HistoryAccessExpression) => void,
): void {
    switch (node.kind) {
        case "identifier-expression":
        case "literal-expression":
        case "na-expression":
        case "unknown-expression":
            return;
        case "history-access-expression":
            visit(node);
            forEachHistoryAccess(node.receiver, visit);
            forEachHistoryAccess(node.offset, visit);
            return;
        case "unary-expression":
            forEachHistoryAccess(node.operand, visit);
            return;
        case "binary-expression":
            forEachHistoryAccess(node.left, visit);
            forEachHistoryAccess(node.right, visit);
            return;
        case "ternary-expression":
            forEachHistoryAccess(node.condition, visit);
            forEachHistoryAccess(node.consequent, visit);
            forEachHistoryAccess(node.alternate, visit);
            return;
        case "call-expression":
            forEachHistoryAccess(node.callee, visit);
            for (const arg of node.args) {
                forEachHistoryAccess(arg.value, visit);
            }
            return;
        case "member-access-expression":
            if (node.head !== null) {
                forEachHistoryAccess(node.head, visit);
            }
            return;
        case "paren-expression":
            forEachHistoryAccess(node.expression, visit);
            return;
        case "tuple-expression":
        case "array-literal-expression":
            for (const element of node.elements) {
                forEachHistoryAccess(element, visit);
            }
            return;
        case "lambda-expression":
            forEachHistoryAccess(node.body, visit);
            return;
        case "switch-expression":
            if (node.subject !== null) {
                forEachHistoryAccess(node.subject, visit);
            }
            for (const arm of node.cases) {
                if (arm.test !== null) {
                    forEachHistoryAccess(arm.test, visit);
                }
                forEachHistoryAccess(arm.value, visit);
            }
            return;
    }
}
