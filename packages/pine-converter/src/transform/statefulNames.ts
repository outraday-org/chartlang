// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CallExpression, ExpressionNode } from "../ast/index.js";

// The bare-named stateful primitives (no namespace): each owns one runtime
// slot keyed by call-site, so the compiler's `stateful-call-inside-loop`
// gate rejects them inside any loop body. `ta.*`/`draw.*` are matched by
// their `ta`/`draw` namespace root, not enumerated here.
const BARE_STATEFUL_NAMES: ReadonlySet<string> = new Set(["plot", "hline", "alert"]);

// The dotted member name of a bare-rooted callee (`ta.ema`, `draw.line`), or
// the bare identifier name (`plot`), or `null` for any other callee shape.
function calleeName(call: CallExpression): string | null {
    const callee = call.callee;
    if (callee.kind === "identifier-expression") {
        return callee.name;
    }
    if (callee.kind === "member-access-expression" && callee.head === null) {
        return callee.chain.join(".");
    }
    return null;
}

/**
 * Whether a call invokes a chartlang **stateful primitive** — `plot`,
 * `hline`, `alert`, any `ta.*`, or any `draw.*`. These each own a single
 * runtime slot keyed by their source position, so chartlang's compiler
 * rejects calling one inside a loop body (`stateful-call-inside-loop`). The
 * converter mirrors this registry to decide whether a Pine `for` loop must
 * be unrolled at convert time rather than emitted as a runtime loop.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { callIsStatefulPrimitive } from "./statefulNames.js";
 *     const call = {
 *         kind: "call-expression",
 *         callee: {
 *             kind: "member-access-expression",
 *             head: null,
 *             chain: ["ta", "ema"],
 *             span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 7 },
 *         },
 *         args: [],
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 9 },
 *     } as const;
 *     callIsStatefulPrimitive(call); // true
 */
export function callIsStatefulPrimitive(call: CallExpression): boolean {
    const name = calleeName(call);
    if (name === null) {
        return false;
    }
    if (BARE_STATEFUL_NAMES.has(name)) {
        return true;
    }
    return name.startsWith("ta.") || name.startsWith("draw.");
}

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
            return node.elements.some((el) => expressionHasStatefulPrimitive(el));
        case "lambda-expression":
            return expressionHasStatefulPrimitive(node.body);
        default:
            return false;
    }
}
