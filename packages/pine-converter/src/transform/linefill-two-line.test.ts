// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { analyze } from "../semantic/index.js";
import { transformCampC } from "./campC.js";
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

const TWO_LINE = [
    "var line lineA = line.new(bar_index, high, bar_index, high)",
    "var line lineB = line.new(bar_index, low, bar_index, low)",
    "var linefill fill = linefill.new(lineA, lineB, color.new(color.gray, 80))",
].join("\n");

describe("transformPolylineLinefill — static two-line linefill", () => {
    it("synthesizes a draw.rotatedRectangle quad over the two lines' endpoints", () => {
        const { scaffold } = run(TWO_LINE);
        const stmt = scaffold.computeBody.statements[0];
        expect(stmt).toContain("draw.rotatedRectangle(");
        // Corners: lineA endpoints (high, high) then lineB endpoints (low, low),
        // ordered [aA, aB, bB, bA] for a closed loop.
        expect(stmt).toContain("bar.point(0, bar.high)");
        expect(stmt).toContain("bar.point(0, bar.low)");
    });

    it("converts the alpha colour from color.new(color.gray, 80) to #787B8633", () => {
        const { scaffold } = run(TWO_LINE);
        expect(scaffold.computeBody.statements[0]).toContain('fill: "#787B8633"');
    });

    it("registers one rectangle-kind handle slot for the fill", () => {
        const { scaffold } = run(TWO_LINE);
        expect(scaffold.handleSlots).toEqual([{ name: "fill", kind: "rectangle", compact: false }]);
    });

    it("emits create-once then per-bar update of the quad anchors", () => {
        const { scaffold } = run(TWO_LINE);
        const stmt = scaffold.computeBody.statements[0];
        expect(stmt).toContain("=== null");
        expect(stmt).toContain("update({ anchors:");
    });

    it("raises the rotatedRectangle + color-transp approximation infos", () => {
        const { diagnostics } = run(TWO_LINE);
        expect(codes(diagnostics)).toContain(
            "pine-converter/transform/linefill-rotatedrect-approximated",
        );
        expect(codes(diagnostics)).toContain(
            "pine-converter/transform/linefill-color-transp-approximated",
        );
    });

    it("does not raise the color-transp info for a bare color arg", () => {
        const body = [
            "var line lineA = line.new(bar_index, high, bar_index, high)",
            "var line lineB = line.new(bar_index, low, bar_index, low)",
            "var linefill fill = linefill.new(lineA, lineB, color=color.gray)",
        ].join("\n");
        const { scaffold, diagnostics } = run(body);
        expect(scaffold.computeBody.statements[0]).toContain('fill: "#787B86"');
        expect(codes(diagnostics)).not.toContain(
            "pine-converter/transform/linefill-color-transp-approximated",
        );
    });

    it("defaults the fill colour when no colour arg is present", () => {
        const body = [
            "var line lineA = line.new(bar_index, high, bar_index, high)",
            "var line lineB = line.new(bar_index, low, bar_index, low)",
            "var linefill fill = linefill.new(lineA, lineB)",
        ].join("\n");
        const { scaffold } = run(body);
        expect(scaffold.computeBody.statements[0]).toContain('fill: "#00000033"');
    });

    it("folds linefill.set_color into a style update on the fill handle", () => {
        const body = `${TWO_LINE}\nlinefill.set_color(fill, color.new(color.red, 0))`;
        const { scaffold } = run(body);
        const joined = scaffold.computeBody.statements.join("\n");
        expect(joined).toContain('update({ style: { fill: "#FF5252FF" } })');
    });

    it("emits remove + clear for linefill.delete", () => {
        const body = `${TWO_LINE}\nlinefill.delete(fill)`;
        const { scaffold } = run(body);
        const joined = scaffold.computeBody.statements.join("\n");
        expect(joined).toContain("fill.current()?.remove();");
        expect(joined).toContain("fill.set(null);");
    });

    it("does not register a fill slot when a referenced line is missing", () => {
        const body = [
            "var line lineA = line.new(bar_index, high, bar_index, high)",
            "var linefill fill = linefill.new(lineA, missingLine, color.gray)",
        ].join("\n");
        const { scaffold } = run(body);
        expect(scaffold.handleSlots).toEqual([]);
    });
});

describe("transformPolylineLinefill — Camp C ownership split", () => {
    function pipeline(body: string): DiagnosticCollector {
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
        // Mirror the Task-16 pipeline order: Camp C then polyline/linefill.
        for (const site of analysis.drawingSites) {
            transformCampC(site, analysis, scaffold, diagnostics);
        }
        transformPolylineLinefill(analysis, scaffold, diagnostics);
        return diagnostics;
    }

    it("does NOT hard-reject a static two-line linefill via Camp C", () => {
        const diagnostics = pipeline(TWO_LINE);
        expect(codes(diagnostics)).not.toContain(
            "pine-converter/semantic/unbounded-handle-collection",
        );
        expect(codes(diagnostics)).toContain(
            "pine-converter/transform/linefill-rotatedrect-approximated",
        );
    });

    it("leaves a cross-collection linefill (array.get) to Camp C's reject", () => {
        const body = [
            "var a = array.new_line()",
            "var b = array.new_line()",
            "lf = linefill.new(array.get(a, 0), array.get(b, 0), color.red)",
        ].join("\n");
        const diagnostics = pipeline(body);
        expect(codes(diagnostics)).toContain("pine-converter/transform/cross-collection-linefill");
    });
});
