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

describe("transformPolylineLinefill — dynamic-length rebuild rejects", () => {
    it("rejects a non-literal (`array.size`) loop bound with polyline-dynamic-points", () => {
        const body = [
            "var array<chart.point> pts = array.new<chart.point>()",
            "for i = 0 to array.size(other)",
            "    array.push(pts, chart.point.from_index(i, close))",
            "var polyline p = polyline.new(pts)",
        ].join("\n");
        const { scaffold, diagnostics } = run(body);
        expect(codes(diagnostics)).toContain("pine-converter/transform/polyline-dynamic-points");
        expect(scaffold.handleSlots).toEqual([]);
        expect(scaffold.computeBody.statements).toEqual([]);
    });

    it("rejects a build loop with a zero `by` step with polyline-dynamic-points", () => {
        const body = [
            "var array<chart.point> pts = array.new<chart.point>()",
            "for i = 0 to 2 by 0",
            "    array.push(pts, chart.point.from_index(i, close))",
            "var polyline p = polyline.new(pts)",
        ].join("\n");
        const { scaffold, diagnostics } = run(body);
        expect(codes(diagnostics)).toContain("pine-converter/transform/polyline-dynamic-points");
        expect(scaffold.handleSlots).toEqual([]);
    });

    it("rejects a build loop with a non-literal `by` step", () => {
        const body = [
            "s = 2",
            "var array<chart.point> pts = array.new<chart.point>()",
            "for i = 0 to 4 by s",
            "    array.push(pts, chart.point.from_index(i, close))",
            "var polyline p = polyline.new(pts)",
        ].join("\n");
        const { diagnostics } = run(body);
        expect(codes(diagnostics)).toContain("pine-converter/transform/polyline-dynamic-points");
    });

    it("rejects a collection with no detectable build loop", () => {
        const body = [
            "var array<chart.point> pts = array.new<chart.point>()",
            "if close > open",
            "    array.push(pts, chart.point.from_index(0, close))",
            "var polyline p = polyline.new(pts)",
        ].join("\n");
        const { diagnostics } = run(body);
        expect(codes(diagnostics)).toContain("pine-converter/transform/polyline-dynamic-points");
    });
});
