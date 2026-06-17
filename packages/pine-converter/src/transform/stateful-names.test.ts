// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { CallExpression, ExpressionNode } from "../ast/index.js";
import type { SourceSpan } from "../index.js";
import { callIsStatefulPrimitive, expressionHasStatefulPrimitive } from "./statefulNames.js";

const SPAN: SourceSpan = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 };

function ident(name: string): ExpressionNode {
    return { kind: "identifier-expression", name, span: SPAN };
}

function member(chain: string[]): ExpressionNode {
    return { kind: "member-access-expression", head: null, chain, span: SPAN };
}

function callOf(callee: ExpressionNode, args: ExpressionNode[] = []): CallExpression {
    return {
        kind: "call-expression",
        callee,
        args: args.map((value) => ({ name: null, value, span: SPAN })),
        span: SPAN,
    };
}

describe("callIsStatefulPrimitive", () => {
    it("recognises the bare stateful primitives", () => {
        expect(callIsStatefulPrimitive(callOf(ident("plot")))).toBe(true);
        expect(callIsStatefulPrimitive(callOf(ident("hline")))).toBe(true);
        expect(callIsStatefulPrimitive(callOf(ident("alert")))).toBe(true);
    });

    it("recognises ta.* and draw.* namespaces", () => {
        expect(callIsStatefulPrimitive(callOf(member(["ta", "ema"])))).toBe(true);
        expect(callIsStatefulPrimitive(callOf(member(["draw", "line"])))).toBe(true);
    });

    it("rejects non-stateful and computed callees", () => {
        expect(callIsStatefulPrimitive(callOf(ident("nz")))).toBe(false);
        expect(callIsStatefulPrimitive(callOf(member(["math", "abs"])))).toBe(false);
        const computed: CallExpression = {
            kind: "call-expression",
            callee: {
                kind: "member-access-expression",
                head: ident("x"),
                chain: ["y"],
                span: SPAN,
            },
            args: [],
            span: SPAN,
        };
        expect(callIsStatefulPrimitive(computed)).toBe(false);
    });
});

describe("expressionHasStatefulPrimitive", () => {
    it("finds a stateful call nested in each expression node kind", () => {
        const stateful = callOf(ident("plot"));
        expect(expressionHasStatefulPrimitive(stateful)).toBe(true);
        expect(
            expressionHasStatefulPrimitive({
                kind: "unary-expression",
                operator: "-",
                operand: stateful,
                span: SPAN,
            }),
        ).toBe(true);
        expect(
            expressionHasStatefulPrimitive({
                kind: "binary-expression",
                operator: "+",
                left: ident("a"),
                right: stateful,
                span: SPAN,
            }),
        ).toBe(true);
        expect(
            expressionHasStatefulPrimitive({
                kind: "ternary-expression",
                condition: ident("c"),
                consequent: ident("a"),
                alternate: stateful,
                span: SPAN,
            }),
        ).toBe(true);
        expect(
            expressionHasStatefulPrimitive({
                kind: "history-access-expression",
                receiver: stateful,
                offset: ident("n"),
                span: SPAN,
            }),
        ).toBe(true);
        expect(
            expressionHasStatefulPrimitive({
                kind: "history-access-expression",
                receiver: ident("close"),
                offset: stateful,
                span: SPAN,
            }),
        ).toBe(true);
        expect(
            expressionHasStatefulPrimitive({
                kind: "member-access-expression",
                head: stateful,
                chain: ["x"],
                span: SPAN,
            }),
        ).toBe(true);
        expect(
            expressionHasStatefulPrimitive({
                kind: "paren-expression",
                expression: stateful,
                span: SPAN,
            }),
        ).toBe(true);
        expect(
            expressionHasStatefulPrimitive({
                kind: "tuple-expression",
                elements: [stateful],
                span: SPAN,
            }),
        ).toBe(true);
        expect(
            expressionHasStatefulPrimitive({
                kind: "lambda-expression",
                params: ["x"],
                body: stateful,
                span: SPAN,
            }),
        ).toBe(true);
        expect(expressionHasStatefulPrimitive(callOf(ident("nz"), [stateful]))).toBe(true);
    });

    it("returns false for leaf and stateless trees", () => {
        expect(expressionHasStatefulPrimitive(ident("close"))).toBe(false);
        expect(expressionHasStatefulPrimitive(member(["math", "abs"]))).toBe(false);
        expect(expressionHasStatefulPrimitive({ kind: "na-expression", span: SPAN })).toBe(false);
        expect(
            expressionHasStatefulPrimitive({
                kind: "member-access-expression",
                head: null,
                chain: ["ta"],
                span: SPAN,
            }),
        ).toBe(false);
    });
});
