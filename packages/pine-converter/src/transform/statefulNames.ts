// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ExpressionNode } from "../ast/index.js";
import { callIsStatefulPrimitive } from "../semantic/statefulness.js";

// `callIsStatefulPrimitive` lives in the neutral `semantic/statefulness.ts`
// module (the semantic UDF classifier shares the same builtin predicate);
// re-export it FROM there so the transform-layer consumers (`controlFlow.ts`,
// `transform/index.ts`) keep their existing import path unchanged. The `from`
// re-export (not a bare `export { x }`) is what the docs gate recognises as a
// forward — the JSDoc lives at the declaration site, not here.
export { callIsStatefulPrimitive } from "../semantic/statefulness.js";

/**
 * Whether any node in an expression subtree is a stateful-primitive call.
 * The loop-unroll decision walks each body statement's expression with this
 * so a `plot(...)` nested in an `if` inside a `for` body still forces an
 * unroll.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { expressionHasStatefulPrimitive } from "./statefulNames.js";
 *     const node = {
 *         kind: "call-expression",
 *         callee: {
 *             kind: "identifier-expression",
 *             name: "plot",
 *             span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 5 },
 *         },
 *         args: [],
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 7 },
 *     } as const;
 *     expressionHasStatefulPrimitive(node); // true
 */
export function expressionHasStatefulPrimitive(node: ExpressionNode): boolean {
    switch (node.kind) {
        case "call-expression":
            if (callIsStatefulPrimitive(node)) {
                return true;
            }
            return (
                expressionHasStatefulPrimitive(node.callee) ||
                node.args.some((arg) => expressionHasStatefulPrimitive(arg.value))
            );
        case "unary-expression":
            return expressionHasStatefulPrimitive(node.operand);
        case "binary-expression":
            return (
                expressionHasStatefulPrimitive(node.left) ||
                expressionHasStatefulPrimitive(node.right)
            );
        case "ternary-expression":
            return (
                expressionHasStatefulPrimitive(node.condition) ||
                expressionHasStatefulPrimitive(node.consequent) ||
                expressionHasStatefulPrimitive(node.alternate)
            );
        case "history-access-expression":
            return (
                expressionHasStatefulPrimitive(node.receiver) ||
                expressionHasStatefulPrimitive(node.offset)
            );
        case "member-access-expression":
            return node.head !== null && expressionHasStatefulPrimitive(node.head);
        case "paren-expression":
            return expressionHasStatefulPrimitive(node.expression);
        case "tuple-expression":
        case "array-literal-expression":
            return node.elements.some((el) => expressionHasStatefulPrimitive(el));
        case "lambda-expression":
            return expressionHasStatefulPrimitive(node.body);
        default:
            return false;
    }
}
