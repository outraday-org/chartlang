// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ExpressionNode } from "../ast/index.js";

/**
 * Emit a Pine-source string for an {@link ExpressionNode} that re-lexes and
 * re-parses to an AST equal to the original modulo spans. Used only by the
 * Task 4 round-trip property test; it is intentionally minimal — it adds
 * explicit parentheses around binary/ternary/unary operands so precedence
 * never has to be re-inferred on the second pass.
 *
 * @since 0.1
 * @stable
 * @example
 *     const ctx = createContext(lex("a + b * c\n").tokens);
 *     unparse(parseExpression(ctx)); // "(a + (b * c))"
 */
export function unparse(node: ExpressionNode): string {
    switch (node.kind) {
        case "identifier-expression":
            return node.name;
        case "literal-expression":
            // `value` is the raw lexeme — string literals keep their quotes.
            return node.value;
        case "na-expression":
            return "na";
        case "unary-expression":
            return `(${node.operator} ${unparse(node.operand)})`;
        case "binary-expression":
            return `(${unparse(node.left)} ${node.operator} ${unparse(node.right)})`;
        case "ternary-expression":
            return `(${unparse(node.condition)} ? ${unparse(node.consequent)} : ${unparse(node.alternate)})`;
        case "call-expression":
            return `${unparse(node.callee)}(${node.args
                .map((arg) =>
                    arg.name === null ? unparse(arg.value) : `${arg.name} = ${unparse(arg.value)}`,
                )
                .join(", ")})`;
        case "member-access-expression": {
            const prefix = node.head === null ? "" : `${unparse(node.head)}.`;
            return `${prefix}${node.chain.join(".")}`;
        }
        case "history-access-expression":
            return `${unparse(node.receiver)}[${unparse(node.offset)}]`;
        case "paren-expression":
            // Operator forms already self-parenthesize, so don't add another
            // layer — a re-parse would otherwise nest a fresh paren each pass.
            return unparse(node.expression);
        case "tuple-expression":
            return `(${node.elements.map(unparse).join(", ")})`;
        case "lambda-expression":
            return `(${node.params.join(", ")}) => ${unparse(node.body)}`;
        case "unknown-expression":
            return node.tokens.map((token) => token.text).join(" ");
    }
}
