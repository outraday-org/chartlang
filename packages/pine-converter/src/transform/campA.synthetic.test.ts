// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { CallExpression } from "../ast/index.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { analyze } from "../semantic/index.js";
import type { DrawingCallSite, SymbolInfo } from "../semantic/index.js";
import { transformCampA } from "./campA.js";
import { anchorToWorldPoint, resolveAnchorExpr } from "./coordinates.js";
import { transformDeclaration } from "./declaration.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import { resolveCampADrawKind } from "./drawKindResolve.js";
import { synthesizeDrawCall } from "./handleSlot.js";
import type { DrawCallContext } from "./handleSlot.js";
import type { ScriptScaffold } from "./ir.js";

const SPAN = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 } as const;

function runCampA(body: string): { scaffold: ScriptScaffold; diagnostics: DiagnosticCollector } {
    const src = `//@version=6\nindicator("X")\n${body}\nplot(close)\n`;
    const analysis = analyze(parseStatements(lex(src).tokens).script);
    const decl = analysis.script.declaration;
    if (
        decl === null ||
        decl.kind === "library-declaration" ||
        decl.kind === "import-declaration"
    ) {
        throw new Error("expected an indicator declaration");
    }
    const diagnostics = new DiagnosticCollector();
    const scaffold = transformDeclaration(decl, analysis, diagnostics);
    for (const site of analysis.drawingSites) {
        if (site.camp.kind === "camp-a") {
            transformCampA(site, analysis, scaffold, diagnostics);
        }
    }
    return { scaffold, diagnostics };
}

// A synthetic `<member chain>(<args>)` call expression for the draw-call
// synthesis and kind-resolution unit tests.
function callExpr(chain: readonly string[], argSrc: string): CallExpression {
    const src = `//@version=6\nindicator("X")\n${chain.join(".")}(${argSrc})\nplot(close)\n`;
    const script = parseStatements(lex(src).tokens).script;
    const stmt = script.body[0];
    if (stmt.kind !== "expression-statement" || stmt.expression.kind !== "call-expression") {
        throw new Error("expected a call expression statement");
    }
    return stmt.expression;
}

const emptyCtx: DrawCallContext = {
    annotations: new Map(),
    anchors: new Map(),
    warn: () => {},
};

describe("resolveCampADrawKind defensive arms", () => {
    it("returns null for an unmapped constructor (linefill)", () => {
        const handle: SymbolInfo = {
            name: "lf",
            kind: "var-variable",
            declarationSpan: SPAN,
            typeAnnotation: null,
            qualifier: "series",
            handleType: "linefill",
        };
        const site: DrawingCallSite = {
            call: callExpr(["linefill", "new"], "a, b"),
            constructor: "linefill.new",
            handleType: "linefill",
            camp: { kind: "camp-a", handleSymbol: handle },
            span: SPAN,
        };
        expect(resolveCampADrawKind(site, new DiagnosticCollector())).toBeNull();
    });

    it("defaults to text when the label style enum is unmapped or non-string", () => {
        const diagnostics = new DiagnosticCollector();
        const site: DrawingCallSite = {
            call: callExpr(["label", "new"], "bar_index, high, style=extend.both"),
            constructor: "label.new",
            handleType: "label",
            camp: {
                kind: "camp-a",
                handleSymbol: {
                    name: "l",
                    kind: "var-variable",
                    declarationSpan: SPAN,
                    typeAnnotation: null,
                    qualifier: "series",
                    handleType: "label",
                },
            },
            span: SPAN,
        };
        expect(resolveCampADrawKind(site, diagnostics)).toBe("text");
        expect(diagnostics.size).toBe(0);
    });

    it("warns label-style-not-mapped for a non-drawing label style", () => {
        const diagnostics = new DiagnosticCollector();
        const site: DrawingCallSite = {
            call: callExpr(["label", "new"], "bar_index, high, style=size.large"),
            constructor: "label.new",
            handleType: "label",
            camp: {
                kind: "camp-a",
                handleSymbol: {
                    name: "l",
                    kind: "var-variable",
                    declarationSpan: SPAN,
                    typeAnnotation: null,
                    qualifier: "series",
                    handleType: "label",
                },
            },
            span: SPAN,
        };
        expect(resolveCampADrawKind(site, diagnostics)).toBe("text");
        expect(diagnostics.toArray().map((d) => d.code)).toContain(
            "pine-converter/transform/label-style-not-mapped",
        );
    });

    it("early-returns from transformCampA when the kind is unmapped", () => {
        const analysis = analyze(
            parseStatements(lex('//@version=6\nindicator("X")\nplot(close)\n').tokens).script,
        );
        const decl = analysis.script.declaration;
        if (decl === null || decl.kind !== "indicator-declaration") {
            throw new Error("expected indicator");
        }
        const diagnostics = new DiagnosticCollector();
        const scaffold = transformDeclaration(decl, analysis, diagnostics);
        const site: DrawingCallSite = {
            call: callExpr(["linefill", "new"], "a, b"),
            constructor: "linefill.new",
            handleType: "linefill",
            camp: {
                kind: "camp-a",
                handleSymbol: {
                    name: "lf",
                    kind: "var-variable",
                    declarationSpan: SPAN,
                    typeAnnotation: null,
                    qualifier: "series",
                    handleType: "linefill",
                },
            },
            span: SPAN,
        };
        transformCampA(site, analysis, scaffold, diagnostics);
        expect(scaffold.handleSlots).toEqual([]);
    });
});

describe("synthesizeDrawCall variants", () => {
    it("emits an arrow-mark-up marker from a single anchor", () => {
        const call = callExpr(["label", "new"], "bar_index, high");
        const out = synthesizeDrawCall("arrow-mark-up", call, {
            ...emptyCtx,
            anchors: new Map([
                [call.args[0].value, { kind: "chart-point-now", priceExpr: "bar.high" }],
            ]),
        });
        expect(out).toContain("draw.arrowMarkUp(");
    });

    it("emits an arrow-mark-down marker", () => {
        const call = callExpr(["label", "new"], "bar_index, low");
        const out = synthesizeDrawCall("arrow-mark-down", call, {
            ...emptyCtx,
            anchors: new Map([
                [call.args[0].value, { kind: "chart-point-now", priceExpr: "bar.low" }],
            ]),
        });
        expect(out).toContain("draw.arrowMarkDown(");
    });

    it("falls back to a NaN anchor when the coordinate is unresolved", () => {
        const call = callExpr(["label", "new"], "bar_index, high");
        const out = synthesizeDrawCall("text", call, emptyCtx);
        expect(out).toContain("price: Number.NaN");
    });

    it("emits an empty text body when no label string is given", () => {
        const call = callExpr(["label", "new"], "bar_index, high");
        const out = synthesizeDrawCall("text", call, {
            ...emptyCtx,
            anchors: new Map([
                [call.args[0].value, { kind: "chart-point-now", priceExpr: "bar.high" }],
            ]),
        });
        expect(out).toContain('draw.text(bar.point(0, bar.high), "")');
    });
});

describe("create-call style enum", () => {
    it("maps line.style_dashed onto the create opts", () => {
        const { scaffold } = runCampA(
            [
                "var line lvl = na",
                "if barstate.islast",
                "    lvl := line.new(bar_index, close, bar_index, close, style=line.style_dashed)",
            ].join("\n"),
        );
        expect(scaffold.computeBody.statements[0]).toContain('lineStyle: "dashed"');
    });
});

describe("set-path-unsupported via campA", () => {
    it("drops a deep single-coordinate setter and reports the info", () => {
        const { scaffold, diagnostics } = runCampA(
            [
                "var line lvl = na",
                "if barstate.islast",
                "    lvl := line.new(bar_index, close, bar_index, close)",
                "    line.set_y1(lvl, close)",
            ].join("\n"),
        );
        expect(scaffold.computeBody.statements.some((s) => s.includes(".update("))).toBe(false);
        expect(diagnostics.toArray().map((d) => d.code)).toContain(
            "pine-converter/transform/set-path-unsupported",
        );
    });
});

describe("yloc dedup", () => {
    it("emits yloc-padding-approximated only once across two labels", () => {
        const { diagnostics } = runCampA(
            [
                "var label a = na",
                "var label b = na",
                "if barstate.islast",
                "    a := label.new(bar_index, high, yloc=yloc.abovebar)",
                "    b := label.new(bar_index, low, yloc=yloc.belowbar)",
            ].join("\n"),
        );
        const codes = diagnostics.toArray().map((d) => d.code);
        expect(codes.filter((c) => c.endsWith("yloc-padding-approximated"))).toHaveLength(1);
    });
});

describe("resolveAnchorExpr", () => {
    it("resolves a bare bar_index to a historical anchor", () => {
        const call = callExpr(["line", "new"], "bar_index, close");
        const [x, y] = call.args;
        const anchor = resolveAnchorExpr(x.value, y.value, new Map());
        expect(anchor.kind).toBe("bar-index-historical");
    });

    it("resolves bar_index + N to a future anchor", () => {
        const call = callExpr(["line", "new"], "bar_index + 3, close");
        const [x, y] = call.args;
        const anchor = resolveAnchorExpr(x.value, y.value, new Map());
        expect(anchor.kind).toBe("bar-index-future");
    });
});

describe("anchorToWorldPoint variants", () => {
    it("renders a literal-world-point", () => {
        expect(anchorToWorldPoint({ kind: "literal-world-point", time: 5, price: 9 })).toBe(
            "{ time: 5, price: 9 }",
        );
    });

    it("renders an expr-world-point", () => {
        expect(
            anchorToWorldPoint({
                kind: "expr-world-point",
                timeExpr: "bar.time",
                priceExpr: "bar.open",
            }),
        ).toBe("{ time: bar.time, price: bar.open }");
    });

    it("renders a bar-index-future as a positive bar.point offset", () => {
        expect(
            anchorToWorldPoint({
                kind: "bar-index-future",
                offsetExpr: "2",
                priceExpr: "bar.close",
                requiresBarInterval: true,
            }),
        ).toBe("bar.point((2), bar.close)");
    });

    it("renders a chart-point-now as the current-bar bar.point", () => {
        expect(anchorToWorldPoint({ kind: "chart-point-now", priceExpr: "bar.close" })).toBe(
            "bar.point(0, bar.close)",
        );
    });

    it("renders a chart-point-new", () => {
        expect(
            anchorToWorldPoint({
                kind: "chart-point-new",
                timeExpr: "t",
                offsetExpr: "0",
                priceExpr: "p",
            }),
        ).toBe("{ time: t, price: p }");
    });

    it("renders a historical anchor with a non-zero offset as a negated bar.point", () => {
        expect(
            anchorToWorldPoint({
                kind: "bar-index-historical",
                offsetExpr: "4",
                priceExpr: "bar.close",
            }),
        ).toBe("bar.point(-(4), bar.close)");
    });

    it("renders a zero-offset historical anchor as the current-bar bar.point", () => {
        expect(
            anchorToWorldPoint({
                kind: "bar-index-historical",
                offsetExpr: "0",
                priceExpr: "bar.close",
            }),
        ).toBe("bar.point(0, bar.close)");
    });
});

describe("campA block scanning", () => {
    it("ignores non-call and non-handle statements while folding", () => {
        const { scaffold } = runCampA(
            [
                "var line lvl = na",
                "if barstate.islast",
                "    x = close + 1",
                "    plot(x)",
                "    lvl := line.new(bar_index, close, bar_index, close)",
                "    line.set_color(lvl, color.red)",
            ].join("\n"),
        );
        const updates = scaffold.computeBody.statements.filter((s) => s.includes(".update("));
        expect(updates).toHaveLength(1);
    });

    it("ignores a bare-callee call and a non-setter handle call", () => {
        const { scaffold } = runCampA(
            [
                "var line lvl = na",
                "if barstate.islast",
                "    lvl := line.new(bar_index, close, bar_index, close)",
                "    foo(lvl)",
                "    line.get_price(lvl, 0)",
                "    line.set_color(lvl, color.red)",
            ].join("\n"),
        );
        const updates = scaffold.computeBody.statements.filter((s) => s.includes(".update("));
        expect(updates).toHaveLength(1);
    });

    it("ignores a bare-expression statement and zero-arg / non-identifier-target calls", () => {
        const { scaffold } = runCampA(
            [
                "var line lvl = na",
                "if barstate.islast",
                "    lvl := line.new(bar_index, close, bar_index, close)",
                "    close",
                "    line.set_color()",
                "    line.set_color(close[1], color.red)",
                "    line.set_width(lvl, 2)",
            ].join("\n"),
        );
        const updates = scaffold.computeBody.statements.filter((s) => s.includes(".update("));
        expect(updates).toHaveLength(1);
        expect(updates[0]).toContain("lineWidth: 2");
    });

    it("scans else-if branches for setters", () => {
        const { scaffold, diagnostics } = runCampA(
            [
                "var label lbl = na",
                "if barstate.islast",
                "    lbl := label.new(bar_index, high)",
                "if a",
                "    label.set_color(lbl, color.red)",
                "else if b",
                "    label.set_color(lbl, color.green)",
                "else",
                "    label.set_color(lbl, color.blue)",
            ].join("\n"),
        );
        const updates = scaffold.computeBody.statements.filter((s) => s.includes(".update("));
        expect(updates).toHaveLength(3);
        expect(diagnostics.toArray().map((d) => d.code)).toContain(
            "pine-converter/transform/setter-fold-cross-branch",
        );
    });
});

describe("text body fallback", () => {
    it("uses an empty body when the label text arg is not a string literal", () => {
        const { scaffold } = runCampA(
            [
                "var label lbl = na",
                "if barstate.islast",
                "    lbl := label.new(bar_index, high, txt)",
            ].join("\n"),
        );
        expect(scaffold.computeBody.statements[0]).toContain(
            'draw.text(bar.point(0, bar.high), "")',
        );
    });
});

describe("marker yloc", () => {
    it("applies yloc padding to a marker anchor", () => {
        const { scaffold, diagnostics } = runCampA(
            [
                "var label lbl = na",
                "if barstate.islast",
                "    lbl := label.new(bar_index, high, style=label.style_circle, yloc=yloc.abovebar)",
            ].join("\n"),
        );
        expect(scaffold.computeBody.statements[0]).toContain("draw.marker(");
        // yloc padding lowers to an inline `0.001` bar-range fraction (no synthesized const).
        expect(scaffold.computeBody.statements[0]).toContain("(bar.high - bar.low) * 0.001");
        expect(diagnostics.toArray().map((d) => d.code)).toContain(
            "pine-converter/transform/yloc-padding-approximated",
        );
    });
});

describe("setter with no value arg", () => {
    it("ignores a style setter missing its value argument", () => {
        const { scaffold } = runCampA(
            [
                "var line lvl = na",
                "if barstate.islast",
                "    lvl := line.new(bar_index, close, bar_index, close)",
                "    line.set_color(lvl)",
            ].join("\n"),
        );
        expect(scaffold.computeBody.statements.some((s) => s.includes(".update("))).toBe(false);
    });
});
