// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type {
    CallArgument,
    CallExpression,
    ExpressionNode,
    VariableDeclaration,
} from "../ast/index.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { analyze } from "../semantic/index.js";
import type { DrawingCallSite, SemanticResult } from "../semantic/index.js";
import { transformDeclaration } from "./declaration.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import type { ScriptScaffold } from "./ir.js";
import { transformPolylineLinefill } from "./polylineLinefill.js";

const SPAN = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 } as const;

function arg(value: ExpressionNode, name: string | null = null): CallArgument {
    return { name, value, span: SPAN };
}

function ident(name: string): ExpressionNode {
    return { kind: "identifier-expression", name, span: SPAN };
}

function intLit(value: string): ExpressionNode {
    return { kind: "literal-expression", literalKind: "int", value, span: SPAN };
}

// A `chart.point.from_index(<idxExpr>, <priceExpr>)` factory call.
function chartPoint(idx: ExpressionNode, price: ExpressionNode): ExpressionNode {
    return {
        kind: "call-expression",
        callee: {
            kind: "member-access-expression",
            head: null,
            chain: ["chart", "point", "from_index"],
            span: SPAN,
        },
        args: [arg(idx), arg(price)],
        span: SPAN,
    };
}

// A synthetic `polyline.new(<tupleElements>, <named...>)` call.
function polylineCall(
    elements: readonly ExpressionNode[],
    named: readonly CallArgument[],
): CallExpression {
    return {
        kind: "call-expression",
        callee: {
            kind: "member-access-expression",
            head: null,
            chain: ["polyline", "new"],
            span: SPAN,
        },
        args: [arg({ kind: "tuple-expression", elements, span: SPAN }), ...named],
        span: SPAN,
    };
}

// Build an analysis for `var p = <ignored polyline.new>` then splice the
// synthetic tuple-bearing call into BOTH the decl initializer and the drawing
// site, so `handleNameOf`'s identity match still finds the `p` binding.
function withSyntheticPolyline(call: CallExpression): {
    analysis: SemanticResult;
    scaffold: ScriptScaffold;
    diagnostics: DiagnosticCollector;
} {
    const src = [
        "//@version=6",
        'indicator("X", overlay=true)',
        "var array<chart.point> pts = array.new<chart.point>()",
        "for i = 0 to 0",
        "    array.push(pts, chart.point.from_index(i, close))",
        "var polyline p = polyline.new(pts)",
        "plot(close)",
        "",
    ].join("\n");
    const analysis = analyze(parseStatements(lex(src).tokens).script);
    const decl = analysis.script.body.find(
        (s): s is VariableDeclaration => s.kind === "variable-declaration" && s.name === "p",
    );
    if (decl === undefined) {
        throw new Error("expected the `p` declaration");
    }
    // Splice the synthetic call into the decl initializer (identity contract).
    (decl as { initializer: ExpressionNode }).initializer = call;
    const site = analysis.drawingSites.find((s) => s.constructor === "polyline.new");
    if (site === undefined) {
        throw new Error("expected a polyline site");
    }
    (site as { call: CallExpression }).call = call;

    const topDecl = analysis.script.declaration;
    if (
        topDecl === null ||
        topDecl.kind === "library-declaration" ||
        topDecl.kind === "import-declaration"
    ) {
        throw new Error("expected an indicator declaration");
    }
    const diagnostics = new DiagnosticCollector();
    const scaffold = transformDeclaration(topDecl, analysis, diagnostics);
    return { analysis, scaffold, diagnostics };
}

const codes = (d: DiagnosticCollector): string[] => d.toArray().map((x) => x.code);

describe("transformPolylineLinefill — literal tuple-array path (parser-unreachable)", () => {
    it("maps a 3-anchor curved literal array to draw.curve", () => {
        const call = polylineCall(
            [
                chartPoint(intLit("0"), ident("close")),
                chartPoint(intLit("1"), ident("close")),
                chartPoint(intLit("2"), ident("close")),
            ],
            [
                arg(
                    { kind: "literal-expression", literalKind: "bool", value: "true", span: SPAN },
                    "curved",
                ),
            ],
        );
        const { analysis, scaffold, diagnostics } = withSyntheticPolyline(call);
        transformPolylineLinefill(analysis, scaffold, diagnostics);
        expect(scaffold.handleSlots).toEqual([{ name: "__p_handle", kind: "polyline" }]);
        expect(scaffold.computeBody.statements[0]).toContain("draw.curve(");
        expect(scaffold.computeBody.statements[0]).toContain("=== null");
    });

    it("maps a 4-anchor straight literal array to draw.polyline", () => {
        const call = polylineCall(
            [0, 1, 2, 3].map((i) => chartPoint(intLit(String(i)), ident("close"))),
            [],
        );
        const { analysis, scaffold, diagnostics } = withSyntheticPolyline(call);
        transformPolylineLinefill(analysis, scaffold, diagnostics);
        expect(scaffold.computeBody.statements[0]).toContain("draw.polyline(");
        expect(codes(diagnostics)).toEqual([]);
    });

    it("maps a closed literal array to draw.path", () => {
        const call = polylineCall(
            [chartPoint(intLit("0"), ident("close")), chartPoint(intLit("1"), ident("close"))],
            [
                arg(
                    { kind: "literal-expression", literalKind: "bool", value: "true", span: SPAN },
                    "closed",
                ),
            ],
        );
        const { analysis, scaffold, diagnostics } = withSyntheticPolyline(call);
        transformPolylineLinefill(analysis, scaffold, diagnostics);
        expect(scaffold.computeBody.statements[0]).toContain("draw.path(");
        expect(codes(diagnostics)).toContain("pine-converter/transform/polyline-closed-info");
    });

    it("emits remove + clear for a polyline.delete against the literal handle", () => {
        const call = polylineCall(
            [chartPoint(intLit("0"), ident("close")), chartPoint(intLit("1"), ident("close"))],
            [],
        );
        const { analysis, scaffold, diagnostics } = withSyntheticPolyline(call);
        // Append a top-level `polyline.delete(p)` to the body.
        (analysis.script.body as unknown[]).push({
            kind: "expression-statement",
            expression: {
                kind: "call-expression",
                callee: {
                    kind: "member-access-expression",
                    head: null,
                    chain: ["polyline", "delete"],
                    span: SPAN,
                },
                args: [arg(ident("p"))],
                span: SPAN,
            },
            span: SPAN,
        });
        transformPolylineLinefill(analysis, scaffold, diagnostics);
        const joined = scaffold.computeBody.statements.join("\n");
        expect(joined).toContain("__p_handle.current()?.remove();");
        expect(joined).toContain("__p_handle.set(null);");
    });
});
