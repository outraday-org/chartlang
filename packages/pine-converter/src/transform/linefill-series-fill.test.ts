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
    const src = `//@version=6\nindicator("BB", overlay=true)\n${body}\nplot(close)\n`;
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

// A Bollinger-band-style fill: both lines are re-anchored every bar.
const SERIES = [
    "var line up = line.new(bar_index, high, bar_index, high)",
    "var line lo = line.new(bar_index, low, bar_index, low)",
    "var linefill fill = linefill.new(up, lo, color.new(color.blue, 90))",
    "line.set_xy1(up, bar_index, high)",
    "line.set_xy1(lo, bar_index, low)",
].join("\n");

describe("transformPolylineLinefill — series-fill detection", () => {
    it("emits the band + a linefill-series-fill info when both lines update each bar", () => {
        const { scaffold, diagnostics } = run(SERIES);
        expect(scaffold.computeBody.statements[0]).toContain("draw.fillBetween(");
        expect(codes(diagnostics)).toContain("pine-converter/transform/linefill-series-fill");
    });

    it("does NOT flag a series fill when only one line is updated", () => {
        const body = [
            "var line up = line.new(bar_index, high, bar_index, high)",
            "var line lo = line.new(bar_index, low, bar_index, low)",
            "var linefill fill = linefill.new(up, lo, color.new(color.blue, 90))",
            "line.set_xy1(up, bar_index, high)",
        ].join("\n");
        const { diagnostics } = run(body);
        expect(codes(diagnostics)).not.toContain("pine-converter/transform/linefill-series-fill");
    });

    it("does NOT flag a series fill when neither line is updated", () => {
        const body = [
            "var line up = line.new(bar_index, high, bar_index, high)",
            "var line lo = line.new(bar_index, low, bar_index, low)",
            "var linefill fill = linefill.new(up, lo, color.new(color.blue, 90))",
        ].join("\n");
        const { diagnostics } = run(body);
        expect(codes(diagnostics)).not.toContain("pine-converter/transform/linefill-series-fill");
    });
});
