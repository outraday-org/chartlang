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

// A literal-bounded `for i = 0 to <to>` build loop over a `chart.point`
// collection, then a `polyline.new(pts, <opts>)`. The square-bracket array
// literal is unreachable through the real parser, so the build-loop idiom is
// the reachable polyline anchor source.
function build(to: number, opts: string): string {
    return [
        "var array<chart.point> pts = array.new<chart.point>()",
        `for i = 0 to ${to}`,
        "    array.push(pts, chart.point.from_index(i, close))",
        `var polyline p = polyline.new(pts${opts})`,
    ].join("\n");
}

describe("transformPolylineLinefill — polyline draw-kind selection", () => {
    it("maps curved=true with exactly 3 anchors to draw.curve", () => {
        const { scaffold, diagnostics } = run(build(2, ", curved=true"));
        const stmt = scaffold.computeBody.statements[0];
        expect(stmt).toContain("draw.curve(");
        expect(stmt).toContain("as const");
        expect(codes(diagnostics)).not.toContain(
            "pine-converter/transform/polyline-curved-anchors-warning",
        );
    });

    it("maps curved=true with >3 anchors to draw.polyline + a warning", () => {
        const { scaffold, diagnostics } = run(build(4, ", curved=true"));
        expect(scaffold.computeBody.statements[0]).toContain("draw.polyline(");
        expect(codes(diagnostics)).toContain(
            "pine-converter/transform/polyline-curved-anchors-warning",
        );
    });

    it("maps a straight (non-curved) polyline to draw.polyline", () => {
        const { scaffold, diagnostics } = run(build(3, ""));
        expect(scaffold.computeBody.statements[0]).toContain("draw.polyline(");
        expect(codes(diagnostics)).toEqual([]);
    });

    it("maps closed=true to draw.path with closed: true + an info", () => {
        const { scaffold, diagnostics } = run(build(2, ", closed=true"));
        const stmt = scaffold.computeBody.statements[0];
        expect(stmt).toContain("draw.path(");
        expect(stmt).toContain("closed: true");
        expect(codes(diagnostics)).toContain("pine-converter/transform/polyline-closed-info");
    });

    it("carries a line_color named arg into the draw opts", () => {
        const { scaffold } = run(build(2, ", line_color=color.blue"));
        expect(scaffold.computeBody.statements[0]).toContain('color: "#2196F3"');
    });

    it("carries line_color into the closed-path opts", () => {
        const { scaffold } = run(build(2, ", closed=true, line_color=color.red"));
        const stmt = scaffold.computeBody.statements[0];
        expect(stmt).toContain("closed: true");
        expect(stmt).toContain('color: "#FF5252"');
    });

    it("emits one polyline handle slot of kind polyline", () => {
        const { scaffold } = run(build(2, ", curved=true"));
        expect(scaffold.handleSlots).toEqual([{ name: "__p_handle", kind: "polyline" }]);
    });

    it("rebuilds the polyline each barstate.islast tick", () => {
        const { scaffold } = run(build(2, ""));
        expect(scaffold.computeBody.statements[0]).toContain("if (barstate.islast)");
        expect(scaffold.computeBody.statements[0]).toContain("__p_handle.current()?.remove()");
    });
});

describe("transformPolylineLinefill — polyline.delete on a literal handle", () => {
    it("emits remove + slot clear", () => {
        const body = [
            "var array<chart.point> pts = array.new<chart.point>()",
            "for i = 0 to 2",
            "    array.push(pts, chart.point.from_index(i, close))",
            "var polyline p = polyline.new(pts)",
            "polyline.delete(p)",
        ].join("\n");
        const { scaffold } = run(body);
        const joined = scaffold.computeBody.statements.join("\n");
        expect(joined).toContain("__p_handle.current()?.remove();");
        expect(joined).toContain("__p_handle.set(null);");
    });
});
