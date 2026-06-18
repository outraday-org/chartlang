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

describe("transformPolylineLinefill — literal-bounded rebuild unroll", () => {
    const body = (to: string): string =>
        [
            "var array<chart.point> pts = array.new<chart.point>()",
            `for i = 0 to ${to}`,
            "    array.push(pts, chart.point.from_index(i, close))",
            "var polyline p = polyline.new(pts, curved=true)",
        ].join("\n");

    it("unrolls a `0 to 2` loop into three substituted anchors", () => {
        const { scaffold, diagnostics } = run(body("2"));
        const stmt = scaffold.computeBody.statements[0];
        // i=0 → offset 0 (current bar); i=1 and i=2 → historical bar.point offsets.
        expect(stmt).toContain("bar.point(0, bar.close)");
        expect(stmt).toContain("bar.point(-(1), bar.close)");
        expect(stmt).toContain("bar.point(-(2), bar.close)");
        expect(diagnostics.toArray()).toHaveLength(0);
    });

    it("unrolls a unary-literal upper bound (`+2`)", () => {
        const { scaffold } = run(body("+2"));
        const stmt = scaffold.computeBody.statements[0];
        expect(stmt).toContain("bar.point(-(2), bar.close)");
    });

    it("registers exactly one polyline handle slot", () => {
        const { scaffold } = run(body("2"));
        expect(scaffold.handleSlots).toEqual([{ name: "p", kind: "polyline", compact: false }]);
    });

    it("unrolls a stepped ascending build loop using the `by` magnitude", () => {
        const stepped = [
            "var array<chart.point> pts = array.new<chart.point>()",
            "for i = 0 to 4 by 2",
            "    array.push(pts, chart.point.from_index(i, close))",
            "var polyline p = polyline.new(pts)",
        ].join("\n");
        const { scaffold } = run(stepped);
        const stmt = scaffold.computeBody.statements[0];
        // i = 0, 2, 4 → offsets 0, 2, 4; never the odd offsets.
        expect(stmt).toContain("bar.point(0, bar.close)");
        expect(stmt).toContain("bar.point(-(2), bar.close)");
        expect(stmt).toContain("bar.point(-(4), bar.close)");
        expect(stmt).not.toContain("bar.point(-(1), bar.close)");
        expect(stmt).not.toContain("bar.point(-(3), bar.close)");
    });

    it("unrolls a descending build loop in descending order", () => {
        const descending = [
            "var array<chart.point> pts = array.new<chart.point>()",
            "for i = 2 to 0",
            "    array.push(pts, chart.point.from_index(i, close))",
            "var polyline p = polyline.new(pts)",
        ].join("\n");
        const { scaffold } = run(descending);
        const stmt = scaffold.computeBody.statements[0];
        // i = 2, 1, 0 → all three offsets present.
        expect(stmt).toContain("bar.point(-(2), bar.close)");
        expect(stmt).toContain("bar.point(-(1), bar.close)");
        expect(stmt).toContain("bar.point(0, bar.close)");
    });

    it("only unrolls the loop that pushes the polyline's collection", () => {
        const withDecoy = [
            "var array<chart.point> other = array.new<chart.point>()",
            "var array<chart.point> pts = array.new<chart.point>()",
            "for j = 0 to 5",
            "    array.push(other, chart.point.from_index(j, open))",
            "for i = 0 to 1",
            "    array.push(pts, chart.point.from_index(i, close))",
            "var polyline p = polyline.new(pts)",
        ].join("\n");
        const { scaffold } = run(withDecoy);
        const stmt = scaffold.computeBody.statements[0];
        // Two anchors from `pts` (i in 0..1), never `open` from the decoy loop.
        expect(stmt).toContain("bar.close");
        expect(stmt).not.toContain("bar.open");
    });
});
