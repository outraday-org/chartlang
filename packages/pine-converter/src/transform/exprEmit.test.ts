// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { ExpressionNode } from "../ast/index.js";
import type { AstNode, SemanticAnnotation } from "../semantic/index.js";
import type { SourceSpan } from "../index.js";
import { emitExpr } from "./exprEmit.js";

const SPAN: SourceSpan = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 };

const ident = (name: string): ExpressionNode => ({
    kind: "identifier-expression",
    name,
    span: SPAN,
});
const int = (value: string): ExpressionNode => ({
    kind: "literal-expression",
    literalKind: "int",
    value,
    span: SPAN,
});
const noAnnotations: ReadonlyMap<AstNode, SemanticAnnotation> = new Map();

describe("emitExpr", () => {
    it("remaps OHLCV identifiers and passes user names through", () => {
        expect(emitExpr(ident("close"), noAnnotations)).toBe("bar.close");
        expect(emitExpr(ident("bar_index"), noAnnotations)).toBe("__bar_index()");
        expect(emitExpr(ident("myVar"), noAnnotations)).toBe("myVar");
    });

    it("emits numeric / string literals verbatim and quotes color literals", () => {
        expect(emitExpr(int("42"), noAnnotations)).toBe("42");
        expect(
            emitExpr(
                { kind: "literal-expression", literalKind: "string", value: '"hi"', span: SPAN },
                noAnnotations,
            ),
        ).toBe('"hi"');
        expect(
            emitExpr(
                { kind: "literal-expression", literalKind: "color", value: "#ff0000", span: SPAN },
                noAnnotations,
            ),
        ).toBe('"#ff0000"');
    });

    it("resolves na to Number.NaN by default and null in a handle context", () => {
        const na: ExpressionNode = { kind: "na-expression", span: SPAN };
        expect(emitExpr(na, noAnnotations)).toBe("Number.NaN");
        const numericAnn: ReadonlyMap<AstNode, SemanticAnnotation> = new Map([
            [na, { naKind: "numeric" }],
        ]);
        expect(emitExpr(na, numericAnn)).toBe("Number.NaN");
        const handleAnn: ReadonlyMap<AstNode, SemanticAnnotation> = new Map([
            [na, { naKind: "handle" }],
        ]);
        expect(emitExpr(na, handleAnn)).toBe("null");
    });

    it("emits unary `not` as `!` and arithmetic unary verbatim", () => {
        expect(
            emitExpr(
                { kind: "unary-expression", operator: "not", operand: ident("flag"), span: SPAN },
                noAnnotations,
            ),
        ).toBe("!flag");
        expect(
            emitExpr(
                { kind: "unary-expression", operator: "-", operand: ident("x"), span: SPAN },
                noAnnotations,
            ),
        ).toBe("-x");
    });

    it("wraps compound operands in parens", () => {
        const inner: ExpressionNode = {
            kind: "binary-expression",
            operator: "+",
            left: ident("a"),
            right: ident("b"),
            span: SPAN,
        };
        expect(
            emitExpr(
                { kind: "unary-expression", operator: "-", operand: inner, span: SPAN },
                noAnnotations,
            ),
        ).toBe("-(a + b)");
    });

    it("maps and/or to && / || and passes arithmetic operators through", () => {
        expect(
            emitExpr(
                {
                    kind: "binary-expression",
                    operator: "and",
                    left: ident("a"),
                    right: ident("b"),
                    span: SPAN,
                },
                noAnnotations,
            ),
        ).toBe("a && b");
        expect(
            emitExpr(
                {
                    kind: "binary-expression",
                    operator: "or",
                    left: ident("a"),
                    right: ident("b"),
                    span: SPAN,
                },
                noAnnotations,
            ),
        ).toBe("a || b");
        expect(
            emitExpr(
                {
                    kind: "binary-expression",
                    operator: "*",
                    left: ident("a"),
                    right: ident("b"),
                    span: SPAN,
                },
                noAnnotations,
            ),
        ).toBe("a * b");
    });

    it("emits ternary expressions", () => {
        expect(
            emitExpr(
                {
                    kind: "ternary-expression",
                    condition: ident("c"),
                    consequent: int("1"),
                    alternate: int("2"),
                    span: SPAN,
                },
                noAnnotations,
            ),
        ).toBe("c ? 1 : 2");
    });

    it("emits call expressions with mapped argument identifiers", () => {
        expect(
            emitExpr(
                {
                    kind: "call-expression",
                    callee: {
                        kind: "member-access-expression",
                        head: null,
                        chain: ["ta", "ema"],
                        span: SPAN,
                    },
                    args: [
                        { name: null, value: ident("close"), span: SPAN },
                        { name: null, value: int("9"), span: SPAN },
                    ],
                    span: SPAN,
                },
                noAnnotations,
            ),
        ).toBe("ta.ema(bar.close, 9)");
    });

    it("emits bare-rooted and computed member chains", () => {
        expect(
            emitExpr(
                {
                    kind: "member-access-expression",
                    head: null,
                    chain: ["chart", "point"],
                    span: SPAN,
                },
                noAnnotations,
            ),
        ).toBe("chart.point");
        expect(
            emitExpr(
                {
                    kind: "member-access-expression",
                    head: {
                        kind: "binary-expression",
                        operator: "+",
                        left: ident("a"),
                        right: ident("b"),
                        span: SPAN,
                    },
                    chain: ["x"],
                    span: SPAN,
                },
                noAnnotations,
            ),
        ).toBe("(a + b).x");
    });

    it("emits history access with the same shape", () => {
        expect(
            emitExpr(
                {
                    kind: "history-access-expression",
                    receiver: ident("close"),
                    offset: int("1"),
                    span: SPAN,
                },
                noAnnotations,
            ),
        ).toBe("bar.close[1]");
    });

    it("emits paren, tuple, and lambda expressions", () => {
        expect(
            emitExpr(
                { kind: "paren-expression", expression: ident("x"), span: SPAN },
                noAnnotations,
            ),
        ).toBe("(x)");
        expect(
            emitExpr(
                { kind: "tuple-expression", elements: [ident("a"), ident("b")], span: SPAN },
                noAnnotations,
            ),
        ).toBe("[a, b]");
        expect(
            emitExpr(
                { kind: "lambda-expression", params: ["x"], body: ident("x"), span: SPAN },
                noAnnotations,
            ),
        ).toBe("(x) => x");
    });

    it("emits an unknown-expression fallback as undefined", () => {
        expect(
            emitExpr({ kind: "unknown-expression", tokens: [], span: SPAN }, noAnnotations),
        ).toBe("undefined");
    });
});
