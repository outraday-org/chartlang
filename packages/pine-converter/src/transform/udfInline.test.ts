// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { transformAndAnalyse } from "@invinite-org/chartlang-compiler";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import type { ExpressionNode } from "../ast/index.js";
import type { Declaration } from "../ast/script.js";
import { convert } from "../index.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { analyze } from "../semantic/index.js";
import { transformDeclaration } from "./declaration.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import type { EmitContext } from "./emitContext.js";
import { transformInputs } from "./inputs.js";
import type { ScriptScaffold } from "./ir.js";
import { NameAllocator } from "./nameAllocator.js";
import { transformOther } from "./other.js";
import { type InlineScope, inlineStatefulCalls } from "./udfInline.js";

type ConvertibleDecl = Extract<
    Declaration,
    { kind: "indicator-declaration" | "strategy-declaration" }
>;

function run(body: string): { scaffold: ScriptScaffold; diagnostics: DiagnosticCollector } {
    const src = `//@version=6\nindicator("X")\n${body}\n`;
    const analysis = analyze(parseStatements(lex(src).tokens).script);
    const decl = analysis.script.declaration;
    if (
        decl === null ||
        decl.kind === "library-declaration" ||
        decl.kind === "import-declaration"
    ) {
        throw new Error("expected an indicator declaration in the fixture");
    }
    const diagnostics = new DiagnosticCollector();
    const scaffold = transformDeclaration(decl as ConvertibleDecl, analysis, diagnostics);
    transformInputs(analysis, scaffold, diagnostics);
    transformOther(analysis, scaffold, diagnostics);
    return { scaffold, diagnostics };
}

function stmts(body: string): readonly string[] {
    return run(body).scaffold.computeBody.statements;
}

function codes(body: string): string[] {
    return run(body)
        .diagnostics.toArray()
        .map((d) => d.code);
}

const INLINED = "pine-converter/transform/udf-inlined";
const HOISTED = "pine-converter/transform/udf-arg-hoisted";

describe("transformOther — stateful UDF inline expansion", () => {
    it("inlines a single-line stateful UDF directly into the call site", () => {
        expect(
            stmts(
                "cf_slope(ma, n) => ta.ema(((ma - ma[1]) / ma[1] * 100), n)\n" +
                    "ma_1 = ta.ema(close, 8)\n" +
                    "s1 = cf_slope(ma_1, 2)\n" +
                    "plot(s1)",
            ),
        ).toEqual([
            "let ma_1 = ta.ema(bar.close, 8).current;",
            "let s1 = ta.ema((((ma_1 - ma_1[1]) / ma_1[1]) * 100), 2).current;",
            "plot(s1);",
        ]);
    });

    it("inlines two call sites to independent ta.* sites (the divergence shape)", () => {
        const out = stmts(
            "cf_slope(ma, n) => ta.ema(ma, n)\n" +
                "ma_1 = ta.ema(close, 8)\n" +
                "ma_2 = ta.ema(close, 21)\n" +
                "s1 = cf_slope(ma_1, 2)\n" +
                "s2 = cf_slope(ma_2, 1)\n" +
                "plot(s1)\nplot(s2)",
        );
        expect(out).toContain("let s1 = ta.ema(ma_1, 2).current;");
        expect(out).toContain("let s2 = ta.ema(ma_2, 1).current;");
    });

    it("raises one udf-inlined info per inlined call site", () => {
        expect(
            codes(
                "cf_slope(ma, n) => ta.ema(ma, n)\n" +
                    "ma_1 = ta.ema(close, 8)\n" +
                    "s1 = cf_slope(ma_1, 2)\n" +
                    "plot(s1)",
            ),
        ).toEqual([INLINED]);
    });

    it("hoists a call-bearing (ta.*) argument to an evaluate-once temp", () => {
        const result = run(
            "cf_d(src, n) => ta.sma(src + src, n)\nx = cf_d(ta.rsi(close, 14), 5)\nplot(x)",
        );
        expect(result.scaffold.computeBody.statements).toEqual([
            "const src2 = ta.rsi(bar.close, 14).current;",
            "let x = ta.sma(src2 + src2, 5).current;",
            "plot(x);",
        ]);
        expect(result.diagnostics.toArray().map((d) => d.code)).toEqual([HOISTED, INLINED]);
    });

    it("inlines a multi-line body with uniquely-named locals + a spliced return", () => {
        expect(
            stmts(
                "cf_band(src, len) =>\n" +
                    "    mid = ta.ema(src, len)\n" +
                    "    width = ta.atr(len)\n" +
                    "    mid + width\n" +
                    "b = cf_band(close, 5)\nplot(b)",
            ),
        ).toEqual([
            "let mid2 = ta.ema(bar.close, 5).current;",
            "let width2 = ta.atr(5).current;",
            "let b = mid2 + width2;",
            "plot(b);",
        ]);
    });

    it("inlines a body whose last statement is the local assignment (returns its value)", () => {
        expect(stmts("cf_one(x) =>\n    r = ta.ema(x, 5)\ny = cf_one(close)\nplot(y)")).toEqual([
            "let r2 = ta.ema(bar.close, 5).current;",
            "let y = r2;",
            "plot(y);",
        ]);
    });

    it("inlines a reassigned (`:=` / `+=`) body local, reusing its unique name", () => {
        expect(
            stmts(
                "cf_acc(x) =>\n" +
                    "    a = ta.ema(x, 5)\n" +
                    "    a := a + 1\n" +
                    "    a += 2\n" +
                    "    a\n" +
                    "y = cf_acc(close)\nplot(y)",
            ),
        ).toEqual([
            "let a2 = ta.ema(bar.close, 5).current;",
            "a2 = a2 + 1;",
            "a2 += 2;",
            "let y = a2;",
            "plot(y);",
        ]);
    });

    it("inlines a body with a typed (`float r =`) intermediate local", () => {
        expect(
            stmts("cf_t(x) =>\n    float r = ta.ema(x, 5)\n    r\ny = cf_t(close)\nplot(y)"),
        ).toEqual(["let r2 = ta.ema(bar.close, 5).current;", "let y = r2;", "plot(y);"]);
    });

    it("inlines a body whose last statement reassigns a local (returns that unique)", () => {
        expect(
            stmts("cf_r(x) =>\n    a = ta.ema(x, 5)\n    a := a * 2\ny = cf_r(close)\nplot(y)"),
        ).toEqual([
            "let a2 = ta.ema(bar.close, 5).current;",
            "a2 = a2 * 2;",
            "let y = a2;",
            "plot(y);",
        ]);
    });

    it("emits an inlined-into expression statement's prelude before the call", () => {
        expect(
            stmts(
                "cf_band(src, len) =>\n" +
                    "    mid = ta.ema(src, len)\n" +
                    "    width = ta.atr(len)\n" +
                    "    mid + width\n" +
                    "plot(cf_band(close, 5))",
            ),
        ).toEqual([
            "let mid2 = ta.ema(bar.close, 5).current;",
            "let width2 = ta.atr(5).current;",
            "plot(mid2 + width2);",
        ]);
    });

    it("inlines a stateful UDF that calls another stateful UDF (nested composition)", () => {
        expect(
            stmts(
                "inner(x, n) => ta.ema(x, n)\nouter(x) => inner(x, 5) + 1\ny = outer(close)\nplot(y)",
            ),
        ).toEqual(["let y = ta.ema(bar.close, 5).current + 1;", "plot(y);"]);
    });

    it("inlines a stateful UDF nested inside a plot argument", () => {
        expect(
            stmts(
                "cf_slope(ma, n) => ta.ema(ma, n)\nma_1 = ta.ema(close, 8)\nplot(cf_slope(ma_1, 2))",
            ),
        ).toEqual(["let ma_1 = ta.ema(bar.close, 8).current;", "plot(ta.ema(ma_1, 2).current);"]);
    });

    it("inlines a stateful UDF nested inside a unary / ternary operand", () => {
        expect(
            stmts(
                "cf_slope(ma, n) => ta.ema(ma, n)\n" +
                    "ma_1 = ta.ema(close, 8)\n" +
                    "s = close > 0 ? -cf_slope(ma_1, 2) : 0.0\nplot(s)",
            ),
        ).toEqual([
            "let ma_1 = ta.ema(bar.close, 8).current;",
            "let s = (bar.close > 0) ? (-ta.ema(ma_1, 2).current) : 0.0;",
            "plot(s);",
        ]);
    });

    it("inlines a stateful UDF called purely for effect (expression statement)", () => {
        expect(stmts('cf_e(x) => alert("hi")\ncf_e(close)')).toEqual(['alert("hi");']);
    });

    it("emits a body intermediate expression statement before the final return", () => {
        expect(
            stmts('cf_two(x) =>\n    alert("hi")\n    ta.ema(x, 5)\ny = cf_two(close)\nplot(y)'),
        ).toEqual(['alert("hi");', "let y = ta.ema(bar.close, 5).current;", "plot(y);"]);
    });

    it("inlines into a typed variable declaration (emitDeclaration path)", () => {
        expect(
            stmts(
                "cf_slope(ma, n) => ta.ema(ma, n)\nma_1 = ta.ema(close, 8)\nfloat s = cf_slope(ma_1, 2)\nplot(s)",
            ),
        ).toEqual([
            "let ma_1 = ta.ema(bar.close, 8).current;",
            "let s = ta.ema(ma_1, 2).current;",
            "plot(s);",
        ]);
    });

    it("inlines into a state-slot reassignment (emitAssignment slot path)", () => {
        expect(
            stmts(
                "cf_slope(ma, n) => ta.ema(ma, n)\n" +
                    "ma_1 = ta.ema(close, 8)\n" +
                    "var float acc = 0.0\n" +
                    "acc := cf_slope(ma_1, 2)\nplot(acc)",
            ),
        ).toEqual([
            "let ma_1 = ta.ema(bar.close, 8).current;",
            "acc.value = ta.ema(ma_1, 2).current;",
            "plot(acc.value);",
        ]);
    });

    it("inlines a body control-flow side effect via the statement fallback", () => {
        expect(
            stmts(
                "cf_side(x) =>\n" +
                    "    if x > 0\n" +
                    "        plot(x)\n" +
                    "    ta.ema(x, 5)\n" +
                    "y = cf_side(close)\nplot(y)",
            ),
        ).toEqual([
            "if (bar.close > 0) { plot(bar.close); }",
            "let y = ta.ema(bar.close, 5).current;",
            "plot(y);",
        ]);
    });

    it("returns Number.NaN for a body whose last statement is control flow (no return)", () => {
        expect(
            stmts("cf_void(x) =>\n    if x > 0\n        plot(x)\ny = cf_void(close)\nplot(y)"),
        ).toEqual(["if (bar.close > 0) { plot(bar.close); }", "let y = Number.NaN;", "plot(y);"]);
    });

    it("leaves an unbound (arity-short) parameter verbatim while still inlining", () => {
        expect(stmts("cf_ab(a, b) => ta.ema(a, 5)\ny = cf_ab(close)\nplot(y)")).toEqual([
            "let y = ta.ema(bar.close, 5).current;",
            "plot(y);",
        ]);
    });

    it("leaves a recursive UDF self-call bare (the inline stack guard)", () => {
        const out = stmts("cf_r(x) => ta.ema(x, 5) + cf_r(x)\ny = cf_r(close)\nplot(y)");
        expect(out[0]).toContain("ta.ema(bar.close, 5).current");
        expect(out[0]).toContain("cf_r(bar.close)");
    });

    it("uses the only-the-last-declaration symbol for a duplicate-named stateful UDF", () => {
        expect(
            stmts("cf(x) => ta.ema(x, 5)\ncf(x) => ta.sma(x, 5)\ny = cf(close)\nplot(y)"),
        ).toEqual(["let y = ta.sma(bar.close, 5).current;", "plot(y);"]);
    });

    it("leaves a pure UDF a reusable function and a non-UDF script untouched", () => {
        // A pure UDF is NOT in the stateful set, so the inline dispatch never
        // fires — it stays Task 3's hoisted reusable function.
        expect(stmts("cf_add(a, b) => a + b\ny = cf_add(close, 2)\nplot(y)")).toEqual([
            "const cf_add = (a: number, b: number) => a + b;",
            "let y = cf_add(bar.close, 2);",
            "plot(y);",
        ]);
        // A script with no UDF at all takes the original (no-walk) path.
        expect(stmts("x = ta.ema(close, 5)\nplot(x)")).toEqual([
            "let x = ta.ema(bar.close, 5).current;",
            "plot(x);",
        ]);
    });
});

describe("inlineStatefulCalls — slot-isolation witness through the compiler", () => {
    it("gives two inlined ta.ema calls DISTINCT compiler slot ids", () => {
        const result = convert(
            '//@version=6\nindicator("X")\n' +
                "cf_slope(ma, n) => ta.ema(ma, n)\n" +
                "ma_1 = ta.ema(close, 8)\n" +
                "ma_2 = ta.ema(close, 21)\n" +
                "s1 = cf_slope(ma_1, 2)\n" +
                "s2 = cf_slope(ma_2, 1)\n" +
                "plot(s1)\nplot(s2)\n",
        );
        expect(result.output).not.toBeNull();
        const source = result.output ?? "";
        const analysed = transformAndAnalyse(source, { sourcePath: "x.chart.ts" });
        // A clean compile (no error-severity diagnostics) — the inlined source
        // is valid chartlang.
        expect(analysed.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
        const printed = ts.createPrinter().printFile(analysed.transformed);
        const slotIds = [...printed.matchAll(/ta\.ema\("([^"]+)"/g)].map((m) => m[1]);
        // Four ta.ema calls (ma_1, ma_2, and the two inlined slope calls), each
        // with a UNIQUE slot id → independent per-call-site state.
        expect(slotIds).toHaveLength(4);
        expect(new Set(slotIds).size).toBe(4);
    });
});

// A minimal scope whose stateful-UDF set is EMPTY, so `inlineStatefulCalls`
// only structurally walks (no inlining) — used to cover `expandNode`'s node-kind
// arms that real source rarely reaches (tuple / lambda / computed member head).
const EMPTY_SCOPE: InlineScope = {
    statefulUdfs: new Map(),
    names: new NameAllocator(),
    diagnostics: new DiagnosticCollector(),
    emitters: { emitValue: () => "0", emitStatement: () => [] },
};
const CTX: EmitContext = {
    annotations: new Map(),
    inputNames: new Set(),
    localNames: new Set(),
    stateSlots: new Map(),
};
const SPAN = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 } as const;
const ID: ExpressionNode = { kind: "identifier-expression", name: "z", span: SPAN };

describe("inlineStatefulCalls — structural walk (no stateful UDFs)", () => {
    it("rebuilds every expression node kind unchanged when nothing inlines", () => {
        const tree: ExpressionNode = {
            kind: "binary-expression",
            operator: "+",
            left: { kind: "unary-expression", operator: "-", operand: ID, span: SPAN },
            right: {
                kind: "ternary-expression",
                condition: { kind: "paren-expression", expression: ID, span: SPAN },
                consequent: {
                    kind: "call-expression",
                    callee: {
                        kind: "member-access-expression",
                        head: null,
                        chain: ["ta", "ema"],
                        span: SPAN,
                    },
                    args: [{ name: null, value: ID, span: SPAN }],
                    span: SPAN,
                },
                alternate: {
                    kind: "history-access-expression",
                    receiver: {
                        kind: "member-access-expression",
                        head: ID,
                        chain: ["field"],
                        span: SPAN,
                    },
                    offset: {
                        kind: "literal-expression",
                        literalKind: "int",
                        value: "1",
                        span: SPAN,
                    },
                    span: SPAN,
                },
                span: SPAN,
            },
            span: SPAN,
        };
        expect(inlineStatefulCalls(tree, CTX, EMPTY_SCOPE, [])).toEqual(tree);

        const tupleLambda: ExpressionNode = {
            kind: "tuple-expression",
            elements: [{ kind: "lambda-expression", params: ["p"], body: ID, span: SPAN }],
            span: SPAN,
        };
        expect(inlineStatefulCalls(tupleLambda, CTX, EMPTY_SCOPE, [])).toEqual(tupleLambda);

        const arrayLiteral: ExpressionNode = {
            kind: "array-literal-expression",
            elements: [ID],
            span: SPAN,
        };
        expect(inlineStatefulCalls(arrayLiteral, CTX, EMPTY_SCOPE, [])).toEqual(arrayLiteral);

        // A bare-rooted call (`f(z)`) whose callee is NOT a stateful UDF takes
        // the structural-recurse path (covers `tryInlineCall` returning null).
        const bareCall: ExpressionNode = {
            kind: "call-expression",
            callee: { kind: "identifier-expression", name: "f", span: SPAN },
            args: [{ name: null, value: ID, span: SPAN }],
            span: SPAN,
        };
        expect(inlineStatefulCalls(bareCall, CTX, EMPTY_SCOPE, [])).toEqual(bareCall);

        expect(
            inlineStatefulCalls({ kind: "na-expression", span: SPAN }, CTX, EMPTY_SCOPE, []),
        ).toEqual({ kind: "na-expression", span: SPAN });
    });
});
