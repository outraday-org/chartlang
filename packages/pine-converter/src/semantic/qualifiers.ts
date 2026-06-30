// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ExpressionNode } from "../ast/index.js";
import { dottedName, rootIdentifier } from "./nodes.js";
import type { SymbolInfo, TypeQualifier } from "./types.js";

const QUALIFIER_RANK: Readonly<Record<TypeQualifier, number>> = {
    const: 0,
    input: 1,
    simple: 2,
    series: 3,
};

const RANK_QUALIFIER: readonly TypeQualifier[] = ["const", "input", "simple", "series"];

/**
 * The lattice join of two qualifiers — the stronger of the two under
 * `const < input < simple < series`.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { joinQualifier } from "./qualifiers.js";
 *     joinQualifier("const", "series"); // "series"
 */
export function joinQualifier(a: TypeQualifier, b: TypeQualifier): TypeQualifier {
    return RANK_QUALIFIER[Math.max(QUALIFIER_RANK[a], QUALIFIER_RANK[b])];
}

/**
 * Resolver passed to {@link inferQualifier}: maps an in-scope name to its
 * {@link SymbolInfo}, or `null` when undeclared.
 *
 * @since 0.1
 * @stable
 * @example
 *     const r: SymbolResolver = () => null;
 *     void r;
 */
export type SymbolResolver = (name: string) => SymbolInfo | null;

// `ta.*` always returns series; `request.security` is a series feed; `input.*`
// returns input-qualified values.
function memberCallQualifier(name: string): TypeQualifier | null {
    if (name.startsWith("ta.")) {
        return "series";
    }
    if (name === "request.security") {
        return "series";
    }
    if (name.startsWith("input.") || name === "input") {
        return "input";
    }
    return null;
}

/**
 * Infer the Pine qualifier of an expression by joining its operands'
 * qualifiers under the `const < input < simple < series` lattice. Literals
 * are `const`; `input.*` calls are `input`; OHLCV/`ta.*` are `series`;
 * binary/ternary/history forms take the lattice join of their parts.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { inferQualifier } from "./qualifiers.js";
 *     inferQualifier(
 *         {
 *             kind: "literal-expression",
 *             literalKind: "int",
 *             value: "1",
 *             span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
 *         },
 *         () => null,
 *     ); // "const"
 */
export function inferQualifier(expr: ExpressionNode, resolve: SymbolResolver): TypeQualifier {
    switch (expr.kind) {
        case "literal-expression":
        case "na-expression":
        case "lambda-expression":
        case "unknown-expression":
            return "const";
        case "identifier-expression":
        case "member-access-expression": {
            const name = dottedName(expr);
            const memberQualifier = name === null ? null : memberCallQualifier(name);
            if (memberQualifier !== null) {
                return memberQualifier;
            }
            const root = rootIdentifier(expr);
            const symbol = root === null ? null : resolve(root);
            return symbol?.qualifier ?? "const";
        }
        case "call-expression": {
            const name = dottedName(expr.callee);
            const calleeQualifier = name === null ? null : memberCallQualifier(name);
            if (calleeQualifier !== null) {
                return calleeQualifier;
            }
            return expr.args.reduce<TypeQualifier>(
                (acc, arg) => joinQualifier(acc, inferQualifier(arg.value, resolve)),
                inferQualifier(expr.callee, resolve),
            );
        }
        case "unary-expression":
            return inferQualifier(expr.operand, resolve);
        case "paren-expression":
            return inferQualifier(expr.expression, resolve);
        case "binary-expression":
            return joinQualifier(
                inferQualifier(expr.left, resolve),
                inferQualifier(expr.right, resolve),
            );
        case "ternary-expression":
            return joinQualifier(
                joinQualifier(
                    inferQualifier(expr.condition, resolve),
                    inferQualifier(expr.consequent, resolve),
                ),
                inferQualifier(expr.alternate, resolve),
            );
        case "history-access-expression":
            return joinQualifier(
                inferQualifier(expr.receiver, resolve),
                inferQualifier(expr.offset, resolve),
            );
        case "tuple-expression":
        case "array-literal-expression":
            return expr.elements.reduce<TypeQualifier>(
                (acc, element) => joinQualifier(acc, inferQualifier(element, resolve)),
                "const",
            );
        case "switch-expression": {
            // The qualifier of a value-`switch` is the join of its subject, every
            // arm test, and every arm value — the same widening a ternary applies.
            const subject = expr.subject === null ? "const" : inferQualifier(expr.subject, resolve);
            return expr.cases.reduce<TypeQualifier>((acc, arm) => {
                const withTest =
                    arm.test === null ? acc : joinQualifier(acc, inferQualifier(arm.test, resolve));
                return joinQualifier(withTest, inferQualifier(arm.value, resolve));
            }, subject);
        }
    }
}
