// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { AstNode, SemanticAnnotation } from "../semantic/index.js";
import type { ExpressionNode } from "../ast/index.js";
import { remapIdentifier } from "../mapping/index.js";

/**
 * Per-node semantic facts the emitter consults — currently just the
 * `naKind` flavour resolved during semantic analysis. Keyed by AST node
 * identity (a `ReadonlyMap`), exactly the shape `SemanticResult.annotations`
 * carries.
 *
 * @since 0.1
 * @experimental
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
    // `na` is the drawing-handle `null` sentinel when the site is a handle
    // context, else the numeric `Number.NaN` sentinel.
    return annotations.get(node)?.naKind === "handle" ? "null" : "Number.NaN";
}

function emitMemberChain(chain: readonly string[], headExpr: string | null): string {
    const tail = chain.join(".");
    return headExpr === null ? tail : `${headExpr}.${tail}`;
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
 * @experimental
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
            return `${operand(node.left, annotations)} ${op} ${operand(node.right, annotations)}`;
        }
        case "ternary-expression":
            return (
                `${operand(node.condition, annotations)} ? ` +
                `${operand(node.consequent, annotations)} : ` +
                `${operand(node.alternate, annotations)}`
            );
        case "call-expression": {
            const callee = emitExpr(node.callee, annotations);
            const args = node.args.map((arg) => emitExpr(arg.value, annotations)).join(", ");
            return `${callee}(${args})`;
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
            return `[${node.elements.map((el) => emitExpr(el, annotations)).join(", ")}]`;
        case "lambda-expression":
            return `(${node.params.join(", ")}) => ${operand(node.body, annotations)}`;
        case "unknown-expression":
            // Unrecoverable parser fallback; never reaches a real coordinate
            // arg. Emit a benign placeholder so the output still parses.
            return "undefined";
    }
}
