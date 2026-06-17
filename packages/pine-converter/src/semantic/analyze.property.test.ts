// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { ExpressionNode, Script } from "../ast/index.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { analyze } from "./analyze.js";
import { BUILTIN_SYMBOLS } from "./builtins.js";

function parse(source: string): Script {
    return parseStatements(lex(source).tokens).script;
}

const HEADER = "//@version=6\nindicator('a')\n";

// Identifier expressions reachable in a walked script.
function* identifiers(node: ExpressionNode): Generator<ExpressionNode> {
    if (node.kind === "identifier-expression") {
        yield node;
        return;
    }
    switch (node.kind) {
        case "unary-expression":
            yield* identifiers(node.operand);
            return;
        case "paren-expression":
            yield* identifiers(node.expression);
            return;
        case "binary-expression":
            yield* identifiers(node.left);
            yield* identifiers(node.right);
            return;
        default:
            return;
    }
}

describe("analyze — property: identifier resolution", () => {
    it("every bare identifier either resolves or emits unknown-identifier", () => {
        const names = fc.constantFrom("close", "open", "high", "low", "volume", "ghost", "zzz");
        fc.assert(
            fc.property(fc.array(names, { minLength: 1, maxLength: 4 }), (operands) => {
                const expr = operands.join(" + ");
                const result = analyze(parse(`${HEADER}x = ${expr}\n`));
                const unknownSpans = new Set(
                    result.diagnostics
                        .filter((d) => d.code === "pine-converter/semantic/unknown-identifier")
                        .map((d) => `${d.span.startLine}:${d.span.startColumn}`),
                );
                for (const decl of result.script.body) {
                    if (decl.kind !== "assignment") {
                        continue;
                    }
                    for (const ident of identifiers(decl.value)) {
                        const resolved =
                            result.scopes.has(ident) &&
                            (BUILTIN_SYMBOLS.has(
                                ident.kind === "identifier-expression" ? ident.name : "",
                            ) ||
                                unknownSpans.has(
                                    `${ident.span.startLine}:${ident.span.startColumn}`,
                                ));
                        expect(resolved).toBe(true);
                    }
                }
            }),
        );
    });
});

describe("analyze — property: lifetimes never precede declaration", () => {
    it("a var handle's reassignment spans never start before its declaration", () => {
        fc.assert(
            fc.property(fc.integer({ min: 1, max: 4 }), (reassignCount) => {
                const lines = [HEADER.trimEnd(), "var line lvl = na"];
                for (let i = 0; i < reassignCount; i += 1) {
                    lines.push("lvl := line.new(bar_index, close, bar_index, close)");
                }
                lines.push("");
                const result = analyze(parse(lines.join("\n")));
                const symbol = [...result.symbols.values()].find((s) => s.name === "lvl");
                expect(symbol).toBeDefined();
                if (symbol === undefined) {
                    return;
                }
                const lifetime = result.lifetimes.get(symbol);
                expect(lifetime).toBeDefined();
                if (lifetime === undefined) {
                    return;
                }
                for (const span of lifetime.reassignments) {
                    expect(span.startLine).toBeGreaterThanOrEqual(
                        lifetime.declarationSpan.startLine,
                    );
                }
            }),
        );
    });
});
