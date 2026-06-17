// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { analyze } from "../semantic/index.js";
import { transformDeclaration } from "./declaration.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import type { ScriptScaffold } from "./ir.js";
import { transformPolylineLinefill } from "./polylineLinefill.js";

function run(body: string): { scaffold: ScriptScaffold; diagnostics: DiagnosticCollector } {
    const src = `//@version=6\nindicator("X", overlay=true)\n${body}\nplot(close)\n`;
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
    transformPolylineLinefill(analysis, scaffold, diagnostics);
    return { scaffold, diagnostics };
}

const codes = (d: DiagnosticCollector): string[] => d.toArray().map((x) => x.code);

describe("transformPolylineLinefill — substituteIterator node arms", () => {
    it("substitutes the iterator inside binary + history + paren index forms", () => {
        const body = [
            "var array<chart.point> pts = array.new<chart.point>()",
            "for i = 0 to 1",
            "    array.push(pts, chart.point.from_index(i + 1, close[i]))",
            "var polyline p = polyline.new(pts)",
        ].join("\n");
        const { scaffold } = run(body);
        const stmt = scaffold.computeBody.statements[0];
        // The `i` iterator was substituted into both the index and the price.
        expect(stmt).toContain("draw.polyline(");
        expect(stmt).toContain("bar.close[");
    });

    it("substitutes the iterator inside a unary-prefixed index", () => {
        const body = [
            "var array<chart.point> pts = array.new<chart.point>()",
            "for i = 0 to 1",
            "    array.push(pts, chart.point.from_index(-i, (close)))",
            "var polyline p = polyline.new(pts)",
        ].join("\n");
        const { scaffold } = run(body);
        expect(scaffold.computeBody.statements[0]).toContain("draw.polyline(");
    });

    it("ignores a non-push statement and a non-chart-point push in the loop body", () => {
        const body = [
            "var array<chart.point> pts = array.new<chart.point>()",
            "for i = 0 to 1",
            "    x = close + i",
            "    array.push(pts, chart.point.from_index(i, close))",
            "var polyline p = polyline.new(pts)",
        ].join("\n");
        const { scaffold } = run(body);
        expect(scaffold.computeBody.statements[0]).toContain("draw.polyline(");
    });

    it("ignores a non-array.push call statement in the loop body", () => {
        const body = [
            "var array<chart.point> pts = array.new<chart.point>()",
            "for i = 0 to 1",
            "    array.clear(pts)",
            "    array.push(pts, chart.point.from_index(i, close))",
            "var polyline p = polyline.new(pts)",
        ].join("\n");
        const { scaffold } = run(body);
        expect(scaffold.computeBody.statements[0]).toContain("draw.polyline(");
    });
});

describe("transformPolylineLinefill — unbound polyline site (no handle name)", () => {
    it("skips a polyline pushed into a collection (no var binding)", () => {
        const body = [
            "var array<polyline> polys = array.new<polyline>()",
            "if barstate.islast",
            "    array.push(polys, polyline.new(somePts))",
        ].join("\n");
        const { scaffold } = run(body);
        // The site is not a `var p = polyline.new(...)` binding, so it is
        // skipped (handleNameOf returns null).
        expect(scaffold.handleSlots).toEqual([]);
    });
});

describe("transformPolylineLinefill — polyline first-arg guards", () => {
    it("rejects a non-identifier, non-tuple first arg with polyline-dynamic-points", () => {
        const body = "var polyline p = polyline.new(close + 1)";
        const { scaffold, diagnostics } = run(body);
        expect(codes(diagnostics)).toContain("pine-converter/transform/polyline-dynamic-points");
        expect(scaffold.handleSlots).toEqual([]);
    });

    it("rejects a polyline.new() with no positional args", () => {
        const body = "var polyline p = polyline.new(curved=true)";
        const { diagnostics } = run(body);
        expect(codes(diagnostics)).toContain("pine-converter/transform/polyline-dynamic-points");
    });
});

describe("transformPolylineLinefill — reassigned polyline handle", () => {
    it("resolves the handle name through a `:=` reassignment", () => {
        const body = [
            "var array<chart.point> pts = array.new<chart.point>()",
            "for i = 0 to 1",
            "    array.push(pts, chart.point.from_index(i, close))",
            "var polyline p = na",
            "p := polyline.new(pts)",
        ].join("\n");
        const { scaffold } = run(body);
        expect(scaffold.handleSlots).toEqual([{ name: "__p_handle", kind: "polyline" }]);
    });
});

describe("transformPolylineLinefill — curve / path opts arms", () => {
    it("carries line_color into the draw.curve opts (3-anchor curved)", () => {
        const body = [
            "var array<chart.point> pts = array.new<chart.point>()",
            "for i = 0 to 2",
            "    array.push(pts, chart.point.from_index(i, close))",
            "var polyline p = polyline.new(pts, curved=true, line_color=color.blue)",
        ].join("\n");
        const { scaffold } = run(body);
        const stmt = scaffold.computeBody.statements[0];
        expect(stmt).toContain("draw.curve(");
        expect(stmt).toContain('color: "#2196F3"');
    });
});

describe("transformPolylineLinefill — linefill anchor + arg guards", () => {
    it("falls back to a NaN anchor when a referenced line has too few coords", () => {
        const body = [
            "var line lineA = line.new(bar_index, high)",
            "var line lineB = line.new(bar_index, low, bar_index, low)",
            "var linefill fill = linefill.new(lineA, lineB, color.gray)",
        ].join("\n");
        const { scaffold } = run(body);
        expect(scaffold.computeBody.statements[0]).toContain("price: Number.NaN");
    });

    it("skips a linefill whose first line arg is not an identifier", () => {
        const body = [
            "var line lineB = line.new(bar_index, low, bar_index, low)",
            "var linefill fill = linefill.new(line.new(bar_index, high, bar_index, high), lineB, color.gray)",
        ].join("\n");
        const { scaffold } = run(body);
        expect(scaffold.handleSlots).toEqual([]);
    });

    it("skips a linefill with missing positional line args", () => {
        const body = "var linefill fill = linefill.new(color=color.gray)";
        const { scaffold } = run(body);
        expect(scaffold.handleSlots).toEqual([]);
    });
});
