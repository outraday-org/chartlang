// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ExpressionNode } from "../ast/index.js";

/**
 * The fully-qualified dotted name of a callee/reference expression, or
 * `null` when it is not a plain identifier or a head-less member chain.
 * `close` → `"close"`; `line.new` → `"line.new"`; `array.push` →
 * `"array.push"`. A member chain with a computed `head` (e.g. `f().g`)
 * yields `null` because it has no stable dotted name.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { dottedName } from "./nodes.js";
 *     dottedName({
 *         kind: "member-access-expression",
 *         head: null,
 *         chain: ["line", "new"],
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 9 },
 *     }); // "line.new"
 */
export function dottedName(expr: ExpressionNode): string | null {
    if (expr.kind === "identifier-expression") {
        return expr.name;
    }
    if (expr.kind === "member-access-expression" && expr.head === null) {
        return expr.chain.join(".");
    }
    return null;
}

/**
 * The leading identifier of a reference — `close` → `"close"`,
 * `line.new` → `"line"`, `array.push` → `"array"`. Used to resolve a
 * member chain's root symbol for qualifier inference. Returns `null` for a
 * computed-head chain or a non-reference node.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { rootIdentifier } from "./nodes.js";
 *     rootIdentifier({
 *         kind: "member-access-expression",
 *         head: null,
 *         chain: ["ta", "ema"],
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 7 },
 *     }); // "ta"
 */
export function rootIdentifier(expr: ExpressionNode): string | null {
    if (expr.kind === "identifier-expression") {
        return expr.name;
    }
    if (expr.kind === "member-access-expression" && expr.head === null && expr.chain.length > 0) {
        return expr.chain[0];
    }
    return null;
}
