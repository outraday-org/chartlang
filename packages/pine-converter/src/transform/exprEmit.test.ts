// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { ExpressionNode } from "../ast/index.js";
import type { SourceSpan } from "../index.js";
import type { AstNode, EnumTypeInfo, SemanticAnnotation } from "../semantic/index.js";
import { emitExpr, forEachHistoryAccess } from "./exprEmit.js";

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
const colorLiteral = (value: string): ExpressionNode => ({
    kind: "literal-expression",
    literalKind: "color",
    value,
    span: SPAN,
});
const member = (...chain: readonly string[]): ExpressionNode => ({
    kind: "member-access-expression",
    head: null,
    chain,
    span: SPAN,
});
const call = (callee: ExpressionNode, ...args: readonly ExpressionNode[]): ExpressionNode => ({
    kind: "call-expression",
    callee,
    args: args.map((value) => ({ name: null, value, span: SPAN })),
    span: SPAN,
});
const noAnnotations: ReadonlyMap<AstNode, SemanticAnnotation> = new Map();

describe("emitExpr", () => {
    it("remaps OHLCV identifiers and passes user names through", () => {
        expect(emitExpr(ident("close"), noAnnotations)).toBe("bar.close");
        expect(emitExpr(ident("bar_index"), noAnnotations)).toBe("__barIndexBridge()");
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

    it("lowers native enum member references to their resolved string values", () => {
        const enumTypes: ReadonlyMap<string, EnumTypeInfo> = new Map([
            [
                "Signal",
                {
                    name: "Signal",
                    defaultMember: "buy",
                    members: [
                        { name: "buy", value: "Buy Signal" },
                        { name: "sell", value: "Sell Signal" },
                    ],
                },
            ],
        ]);
        expect(
            emitExpr(
                {
                    kind: "member-access-expression",
                    head: null,
                    chain: ["Signal", "buy"],
                    span: SPAN,
                },
                noAnnotations,
                enumTypes,
            ),
        ).toBe('"Buy Signal"');
        expect(
            emitExpr(
                {
                    kind: "member-access-expression",
                    head: null,
                    chain: ["Unknown", "buy"],
                    span: SPAN,
                },
                noAnnotations,
                enumTypes,
            ),
        ).toBe("Unknown.buy");
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
        // A `var color x = na` lowers to the transparent CSS string.
        const colorAnn: ReadonlyMap<AstNode, SemanticAnnotation> = new Map([
            [na, { naKind: "color" }],
        ]);
        expect(emitExpr(na, colorAnn)).toBe('"#00000000"');
    });

    it("lowers `na(x)` to a real predicate by the callee's na flavour", () => {
        const naCallee: ExpressionNode = { kind: "na-expression", span: SPAN };
        const numericCall: ExpressionNode = {
            kind: "call-expression",
            callee: naCallee,
            args: [{ name: null, value: ident("ph"), span: SPAN }],
            span: SPAN,
        };
        // Numeric flavour (default): finite-number test.
        expect(emitExpr(numericCall, noAnnotations)).toBe("!Number.isFinite(ph)");
        // Handle flavour: null test.
        const handleAnn: ReadonlyMap<AstNode, SemanticAnnotation> = new Map([
            [naCallee, { naKind: "handle" }],
        ]);
        expect(emitExpr(numericCall, handleAnn)).toBe("(ph === null)");
        // No argument → falls back to the structural call emit (`Number.NaN()`).
        const noArgCall: ExpressionNode = {
            kind: "call-expression",
            callee: naCallee,
            args: [],
            span: SPAN,
        };
        expect(emitExpr(noArgCall, noAnnotations)).toBe("Number.NaN()");
    });

    it("lowers a bare-rooted calendar built-in call via the call-form table", () => {
        const dayofweekCall: ExpressionNode = {
            kind: "call-expression",
            callee: ident("dayofweek"),
            args: [{ name: null, value: ident("time"), span: SPAN }],
            span: SPAN,
        };
        // `time` would remap to `bar.time` as an arg, and the callee interception
        // fires before the generic `callee(args)` path.
        expect(emitExpr(dayofweekCall, noAnnotations)).toBe("time.dayofweek(bar.time)");
    });

    it("falls through to the generic call path for a non-calendar identifier call", () => {
        const userCall: ExpressionNode = {
            kind: "call-expression",
            callee: ident("myFn"),
            args: [
                { name: null, value: int("1") },
                { name: null, value: ident("x") },
            ].map((a) => ({
                ...a,
                span: SPAN,
            })),
            span: SPAN,
        };
        expect(emitExpr(userCall, noAnnotations)).toBe("myFn(1, x)");
    });

    it("lowers color.new in free expressions with literal and dynamic bases", () => {
        expect(
            emitExpr(
                call(member("color", "new"), member("color", "red"), int("30")),
                noAnnotations,
            ),
        ).toBe('"#FF5252B3"');
        expect(
            emitExpr(call(member("color", "new"), ident("trendColor"), int("0")), noAnnotations),
        ).toBe("color.withAlpha(trendColor, 1)");
    });

    it("lowers color.rgb in free expressions without changing dynamic 3-arg calls", () => {
        expect(
            emitExpr(call(member("color", "rgb"), int("54"), int("58"), int("69")), noAnnotations),
        ).toBe('"#363A45"');
        expect(
            emitExpr(call(member("color", "rgb"), ident("r"), int("58"), int("69")), noAnnotations),
        ).toBe("color.rgb(r, 58, 69)");
    });

    it("lowers 4-arg color.rgb in free expressions", () => {
        expect(
            emitExpr(
                call(member("color", "rgb"), int("54"), int("58"), int("69"), int("40")),
                noAnnotations,
            ),
        ).toBe('"#363A4599"');
        expect(
            emitExpr(
                call(
                    member("color", "rgb"),
                    colorLiteral("#112233"),
                    int("58"),
                    int("69"),
                    ident("t"),
                ),
                noAnnotations,
            ),
        ).toBe('color.withAlpha(color.rgb("#112233", 58, 69), (100 - t) / 100)');
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

    it("widens a literal == literal comparison with a same-base `as` cast", () => {
        const lit = (
            literalKind: "string" | "int" | "float" | "bool" | "color",
            value: string,
        ): ExpressionNode => ({ kind: "literal-expression", literalKind, value, span: SPAN });
        const binary = (
            operator: string,
            left: ExpressionNode,
            right: ExpressionNode,
        ): ExpressionNode => ({ kind: "binary-expression", operator, left, right, span: SPAN });
        // String/number/bool literal pairs widen the LEFT with a same-base cast
        // so a value-switch dropdown read (`(mode as string) == "SMA"`) narrows.
        expect(
            emitExpr(binary("==", lit("string", '"SMA"'), lit("string", '"SMA"')), noAnnotations),
        ).toBe('("SMA" as string) == "SMA"');
        expect(emitExpr(binary("!=", lit("int", "1"), lit("int", "2")), noAnnotations)).toBe(
            "(1 as number) != 2",
        );
        expect(
            emitExpr(binary("==", lit("bool", "true"), lit("bool", "false")), noAnnotations),
        ).toBe("(true as boolean) == false");
        // No widening: a color literal has no widening base (default arm → null),
        // a non-`==`/`!=` operator, and a non-literal operand all pass through.
        expect(
            emitExpr(binary("==", lit("color", "#fff"), lit("color", "#fff")), noAnnotations),
        ).toBe('"#fff" == "#fff"');
        expect(emitExpr(binary("+", lit("int", "1"), lit("int", "2")), noAnnotations)).toBe(
            "1 + 2",
        );
        expect(emitExpr(binary("==", ident("a"), lit("int", "2")), noAnnotations)).toBe("a == 2");
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
                {
                    kind: "array-literal-expression",
                    elements: [ident("a"), ident("b")],
                    span: SPAN,
                },
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

describe("forEachHistoryAccess", () => {
    const history = (receiver: ExpressionNode, offset: ExpressionNode): ExpressionNode => ({
        kind: "history-access-expression",
        receiver,
        offset,
        span: SPAN,
    });
    const names = (node: ExpressionNode): string[] => {
        const out: string[] = [];
        forEachHistoryAccess(node, (h) => {
            if (h.receiver.kind === "identifier-expression") {
                out.push(h.receiver.name);
            }
        });
        return out;
    };

    it("visits a bare history access and its leaf operands", () => {
        expect(names(history(ident("prev"), int("1")))).toEqual(["prev"]);
        // Leaf nodes (identifier / literal / na / unknown) recurse to nothing.
        expect(names(ident("x"))).toEqual([]);
        expect(names(int("1"))).toEqual([]);
        expect(names({ kind: "na-expression", span: SPAN })).toEqual([]);
        expect(names({ kind: "unknown-expression", tokens: [], span: SPAN })).toEqual([]);
    });

    it("descends unary / binary / ternary / paren operand trees", () => {
        expect(
            names({
                kind: "unary-expression",
                operator: "-",
                operand: history(ident("a"), int("1")),
                span: SPAN,
            }),
        ).toEqual(["a"]);
        expect(
            names({
                kind: "binary-expression",
                operator: "+",
                left: history(ident("b"), int("1")),
                right: history(ident("c"), int("2")),
                span: SPAN,
            }),
        ).toEqual(["b", "c"]);
        expect(
            names({
                kind: "ternary-expression",
                condition: history(ident("d"), int("1")),
                consequent: history(ident("e"), int("1")),
                alternate: history(ident("f"), int("1")),
                span: SPAN,
            }),
        ).toEqual(["d", "e", "f"]);
        expect(
            names({
                kind: "paren-expression",
                expression: history(ident("g"), int("1")),
                span: SPAN,
            }),
        ).toEqual(["g"]);
    });

    it("descends call callee + args and a computed member head", () => {
        expect(
            names({
                kind: "call-expression",
                callee: ident("f"),
                args: [{ name: null, value: history(ident("h"), int("1")), span: SPAN }],
                span: SPAN,
            }),
        ).toEqual(["h"]);
        expect(
            names({
                kind: "member-access-expression",
                head: history(ident("m"), int("1")),
                chain: ["field"],
                span: SPAN,
            }),
        ).toEqual(["m"]);
        // A null-head member chain (`a.b.c`) carries no history operand.
        expect(
            names({ kind: "member-access-expression", head: null, chain: ["a", "b"], span: SPAN }),
        ).toEqual([]);
    });

    it("descends tuple elements and a lambda body", () => {
        expect(
            names({
                kind: "tuple-expression",
                elements: [history(ident("t1"), int("1")), history(ident("t2"), int("2"))],
                span: SPAN,
            }),
        ).toEqual(["t1", "t2"]);
        expect(
            names({
                kind: "array-literal-expression",
                elements: [history(ident("a1"), int("1")), history(ident("a2"), int("2"))],
                span: SPAN,
            }),
        ).toEqual(["a1", "a2"]);
        expect(
            names({
                kind: "lambda-expression",
                params: ["x"],
                body: history(ident("lb"), int("1")),
                span: SPAN,
            }),
        ).toEqual(["lb"]);
    });

    it("recurses into a nested history receiver (`x[1][2]`)", () => {
        expect(names(history(history(ident("n"), int("1")), int("2")))).toEqual(["n"]);
    });
});

describe("emitExpr — value-form switch", () => {
    const sw = (
        subject: ExpressionNode | null,
        cases: ReadonlyArray<{ test: ExpressionNode | null; value: ExpressionNode }>,
    ): ExpressionNode => ({
        kind: "switch-expression",
        subject,
        cases: cases.map((c) => ({ ...c, span: SPAN })),
        span: SPAN,
    });
    const str = (v: string): ExpressionNode => ({
        kind: "literal-expression",
        literalKind: "string",
        value: v,
        span: SPAN,
    });

    it("lowers a subject form to a chained ternary ending in Number.NaN", () => {
        expect(
            emitExpr(
                sw(ident("sel"), [
                    { test: str('"A"'), value: int("1") },
                    { test: str('"B"'), value: int("2") },
                ]),
                noAnnotations,
            ),
        ).toBe('sel === "A" ? 1 : sel === "B" ? 2 : Number.NaN');
    });

    it("lowers the subject-less form using each arm condition directly", () => {
        expect(
            emitExpr(
                sw(null, [
                    { test: ident("c"), value: int("1") },
                    { test: ident("d"), value: int("2") },
                ]),
                noAnnotations,
            ),
        ).toBe("c ? 1 : d ? 2 : Number.NaN");
    });

    it("uses a wildcard default arm as the chain fallback", () => {
        expect(
            emitExpr(
                sw(ident("sel"), [
                    { test: str('"A"'), value: int("1") },
                    { test: null, value: int("9") },
                ]),
                noAnnotations,
            ),
        ).toBe('sel === "A" ? 1 : 9');
    });

    it("lowers an empty switch to the bare Number.NaN fallback", () => {
        expect(emitExpr(sw(ident("sel"), []), noAnnotations)).toBe("Number.NaN");
    });

    it("parenthesises a non-atomic subject, condition, and value", () => {
        const sum = (a: string, b: string): ExpressionNode => ({
            kind: "binary-expression",
            operator: "+",
            left: ident(a),
            right: ident(b),
            span: SPAN,
        });
        expect(
            emitExpr(sw(sum("a", "b"), [{ test: int("0"), value: sum("c", "d") }]), noAnnotations),
        ).toBe("(a + b) === 0 ? (c + d) : Number.NaN");
    });
});

describe("forEachHistoryAccess — value-form switch", () => {
    const hist = (name: string): ExpressionNode => ({
        kind: "history-access-expression",
        receiver: { kind: "identifier-expression", name, span: SPAN },
        offset: { kind: "literal-expression", literalKind: "int", value: "1", span: SPAN },
        span: SPAN,
    });
    const collect = (node: ExpressionNode): string[] => {
        const out: string[] = [];
        forEachHistoryAccess(node, (h) => {
            if (h.receiver.kind === "identifier-expression") {
                out.push(h.receiver.name);
            }
        });
        return out;
    };

    it("descends the subject and every arm test/value", () => {
        const node: ExpressionNode = {
            kind: "switch-expression",
            subject: hist("subj"),
            cases: [
                { test: hist("t0"), value: hist("v0"), span: SPAN },
                { test: null, value: hist("v1"), span: SPAN },
            ],
            span: SPAN,
        };
        expect(collect(node)).toEqual(["subj", "t0", "v0", "v1"]);
    });

    it("handles a subject-less switch", () => {
        const node: ExpressionNode = {
            kind: "switch-expression",
            subject: null,
            cases: [{ test: hist("c0"), value: hist("r0"), span: SPAN }],
            span: SPAN,
        };
        expect(collect(node)).toEqual(["c0", "r0"]);
    });
});
