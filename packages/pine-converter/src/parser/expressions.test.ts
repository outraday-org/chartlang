// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { BinaryExpression, ExpressionNode } from "../ast/index.js";
import { lex } from "../lexer/index.js";
import { createContext } from "./context.js";
import { parseExpression } from "./expressions.js";

function exprFrom(source: string): ExpressionNode {
    const ctx = createContext(lex(source).tokens);
    return parseExpression(ctx);
}

function exprAndDiagnostics(source: string) {
    const ctx = createContext(lex(source).tokens);
    const expr = parseExpression(ctx);
    return { expr, codes: ctx.diagnostics.map((d) => d.code) };
}

function asBinary(node: ExpressionNode): BinaryExpression {
    if (node.kind !== "binary-expression") {
        throw new Error(`expected binary-expression, got ${node.kind}`);
    }
    return node;
}

describe("parseExpression — primaries", () => {
    it("parses an identifier", () => {
        const e = exprFrom("close\n");
        expect(e.kind).toBe("identifier-expression");
    });

    it("parses each literal kind", () => {
        expect(exprFrom("42\n")).toMatchObject({ literalKind: "int" });
        expect(exprFrom("1.5\n")).toMatchObject({ literalKind: "float" });
        expect(exprFrom('"hi"\n')).toMatchObject({ literalKind: "string" });
        expect(exprFrom("#ff0000\n")).toMatchObject({ literalKind: "color" });
        expect(exprFrom("true\n")).toMatchObject({ literalKind: "bool" });
        expect(exprFrom("false\n")).toMatchObject({ literalKind: "bool" });
    });

    it("parses na", () => {
        expect(exprFrom("na\n").kind).toBe("na-expression");
    });

    it("returns an unknown-expression for an unstartable position", () => {
        const e = exprFrom(")\n");
        expect(e.kind).toBe("unknown-expression");
    });
});

describe("parseExpression — operator precedence", () => {
    it("binds * tighter than +", () => {
        const e = asBinary(exprFrom("a + b * c\n"));
        expect(e.operator).toBe("+");
        expect(e.right.kind).toBe("binary-expression");
    });

    it("binds + left-associatively", () => {
        const e = asBinary(exprFrom("a - b - c\n"));
        expect(e.operator).toBe("-");
        expect(e.left.kind).toBe("binary-expression");
    });

    it("binds comparison tighter than and/or", () => {
        const e = asBinary(exprFrom("a < b and c > d\n"));
        expect(e.operator).toBe("and");
        expect(e.left.kind).toBe("binary-expression");
        expect(e.right.kind).toBe("binary-expression");
    });

    it("binds and tighter than or", () => {
        const e = asBinary(exprFrom("a or b and c\n"));
        expect(e.operator).toBe("or");
        expect(e.right.kind).toBe("binary-expression");
    });

    it("binds == below relational", () => {
        const e = asBinary(exprFrom("a < b == c\n"));
        expect(e.operator).toBe("==");
        expect(e.left.kind).toBe("binary-expression");
    });

    it("parses %", () => {
        expect(asBinary(exprFrom("a % b\n")).operator).toBe("%");
    });
});

describe("parseExpression — unary", () => {
    it("parses unary minus", () => {
        const e = exprFrom("-x\n");
        expect(e).toMatchObject({ kind: "unary-expression", operator: "-" });
    });

    it("parses unary plus", () => {
        expect(exprFrom("+x\n")).toMatchObject({ kind: "unary-expression", operator: "+" });
    });

    it("parses not", () => {
        expect(exprFrom("not flag\n")).toMatchObject({ kind: "unary-expression", operator: "not" });
    });
});

describe("parseExpression — ternary", () => {
    it("parses a ternary", () => {
        expect(exprFrom("c ? 1 : 2\n").kind).toBe("ternary-expression");
    });

    it("flags a chained ternary with info", () => {
        const { expr, codes } = exprAndDiagnostics("a ? b : c ? d : e\n");
        expect(expr.kind).toBe("ternary-expression");
        expect(codes).toContain("pine-converter/parse/chained-ternary-warning");
    });
});

describe("parseExpression — calls and members", () => {
    it("parses a positional call", () => {
        const e = exprFrom("plot(close)\n");
        expect(e.kind).toBe("call-expression");
    });

    it("parses positional then named args", () => {
        const e = exprFrom("ta.ema(close, length = 9)\n");
        if (e.kind === "call-expression") {
            expect(e.args[0].name).toBeNull();
            expect(e.args[1].name).toBe("length");
        }
    });

    it("rejects a positional arg after a named one", () => {
        const { codes } = exprAndDiagnostics("f(a = 1, 2)\n");
        expect(codes).toContain("pine-converter/parse/mixed-named-positional-args");
    });

    it("parses an empty call", () => {
        const e = exprFrom("foo()\n");
        if (e.kind === "call-expression") {
            expect(e.args).toHaveLength(0);
        }
    });

    it("parses a member chain of depth 3", () => {
        const e = exprFrom("a.b.c\n");
        if (e.kind === "member-access-expression") {
            expect(e.chain).toEqual(["a", "b", "c"]);
            expect(e.head).toBeNull();
        }
    });

    it("parses chart.point.new(...) as a call over a member chain", () => {
        const e = exprFrom("chart.point.new(t, i, p)\n");
        if (e.kind === "call-expression" && e.callee.kind === "member-access-expression") {
            expect(e.callee.chain).toEqual(["chart", "point", "new"]);
        }
    });

    it("keeps a computed receiver as head", () => {
        const e = exprFrom("f().bar\n");
        if (e.kind === "member-access-expression") {
            expect(e.head?.kind).toBe("call-expression");
            expect(e.chain).toEqual(["bar"]);
        }
    });

    it("recovers when a member name is missing", () => {
        const { codes } = exprAndDiagnostics("a.)\n");
        expect(codes).toContain("pine-converter/parse/expected-token");
    });

    it("recovers when a call is unterminated", () => {
        const { codes } = exprAndDiagnostics("f(a\n");
        expect(codes).toContain("pine-converter/parse/expected-token");
    });
});

describe("parseExpression — paren / tuple / lambda", () => {
    it("parses a parenthesized expression", () => {
        expect(exprFrom("(a + b)\n").kind).toBe("paren-expression");
    });

    it("parses a tuple", () => {
        const e = exprFrom("(a, b)\n");
        if (e.kind === "tuple-expression") {
            expect(e.elements).toHaveLength(2);
        }
    });

    it("parses a lambda", () => {
        const e = exprFrom("(x) => x + 1\n");
        if (e.kind === "lambda-expression") {
            expect(e.params).toEqual(["x"]);
        }
    });

    it("gives a lambda param an empty name when it is not an identifier", () => {
        const e = exprFrom("(1) => x\n");
        if (e.kind === "lambda-expression") {
            expect(e.params).toEqual([""]);
        }
    });

    it("recovers an unterminated paren", () => {
        const { codes } = exprAndDiagnostics("(a\n");
        expect(codes).toContain("pine-converter/parse/expected-token");
    });
});
