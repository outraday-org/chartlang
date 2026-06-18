// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { Declaration } from "../ast/script.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { analyze } from "../semantic/index.js";
import { transformCampB } from "./campB.js";
import { transformDeclaration } from "./declaration.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import type { ScriptScaffold } from "./ir.js";

type ConvertibleDecl = Extract<
    Declaration,
    { kind: "indicator-declaration" | "strategy-declaration" }
>;

function runCampB(body: string): {
    scaffold: ScriptScaffold;
    diagnostics: DiagnosticCollector;
} {
    const src = `//@version=6\nindicator("X", overlay=true)\n${body}\nplot(close)\n`;
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
    for (const site of analysis.drawingSites) {
        if (site.camp.kind === "camp-b") {
            transformCampB(site, analysis, scaffold, diagnostics);
        }
    }
    return { scaffold, diagnostics };
}

const PIVOT_FIXTURE = [
    "var lvls = array.new_line()",
    "if close > open",
    "    array.push(lvls, line.new(bar_index, close, bar_index, close, color=color.red))",
    "if array.size(lvls) > 50",
    "    line.delete(array.shift(lvls))",
].join("\n");

describe("transformCampB — canonical pivot ring", () => {
    it("registers exactly one line ring at the eviction cap", () => {
        const { scaffold } = runCampB(PIVOT_FIXTURE);
        expect(scaffold.handleRings).toEqual([{ name: "lvls", kind: "line", cap: 50 }]);
    });

    it("emits one guarded ring.push with the mapped draw call", () => {
        const { scaffold } = runCampB(PIVOT_FIXTURE);
        const pushes = scaffold.computeBody.statements.filter((s) => s.includes(".push("));
        expect(pushes).toHaveLength(1);
        expect(pushes[0]).toContain("if (bar.close > bar.open)");
        expect(pushes[0]).toContain("lvls.push(draw.line(");
        expect(pushes[0]).toContain('color: "#FF5252"');
    });

    it("elides the eviction block and emits ring-eviction-implicit once", () => {
        const { scaffold, diagnostics } = runCampB(PIVOT_FIXTURE);
        const joined = scaffold.computeBody.statements.join("\n");
        expect(joined).not.toContain("array.shift");
        expect(joined).not.toContain("line.delete");
        const evictions = diagnostics
            .toArray()
            .filter((d) => d.code === "pine-converter/transform/ring-eviction-implicit");
        expect(evictions).toHaveLength(1);
    });

    it("emits an unguarded push when the push is at the top level", () => {
        const { scaffold } = runCampB(
            [
                "var lvls = array.new_line()",
                "array.push(lvls, line.new(bar_index, close, bar_index, close))",
                "if array.size(lvls) > 20",
                "    line.delete(array.shift(lvls))",
            ].join("\n"),
        );
        const pushes = scaffold.computeBody.statements.filter((s) => s.includes(".push("));
        expect(pushes).toHaveLength(1);
        expect(pushes[0]).not.toContain("if (");
        expect(pushes[0].startsWith("lvls.push(")).toBe(true);
    });
});

describe("transformCampB — bucket default cap", () => {
    it("uses the bucket default of 50 when no explicit eviction cap is found", () => {
        const { scaffold } = runCampB(
            [
                "var lvls = array.new_line()",
                "array.push(lvls, line.new(bar_index, close, bar_index, close))",
            ].join("\n"),
        );
        expect(scaffold.handleRings).toEqual([{ name: "lvls", kind: "line", cap: 50 }]);
    });
});

describe("transformCampB — non-camp-b sites are ignored", () => {
    it("does nothing for a Camp A handle site", () => {
        const { scaffold } = runCampB(
            ["var line lvl = na", "lvl := line.new(bar_index, close, bar_index, close)"].join("\n"),
        );
        expect(scaffold.handleRings).toHaveLength(0);
    });
});

describe("transformCampB — polyline collections are deferred", () => {
    it("registers no ring for a polyline collection (Task 14 territory)", () => {
        const { scaffold } = runCampB(
            [
                "var pl = array.new_polyline()",
                "array.push(pl, polyline.new(points))",
                "if array.size(pl) > 10",
                "    polyline.delete(array.shift(pl))",
            ].join("\n"),
        );
        expect(scaffold.handleRings).toHaveLength(0);
    });
});

describe("transformCampB — box ring maps to rectangle", () => {
    it("registers a rectangle ring for a box collection", () => {
        const { scaffold } = runCampB(
            [
                "var zones = array.new_box()",
                "array.push(zones, box.new(bar_index, high, bar_index, low))",
                "if array.size(zones) > 10",
                "    box.delete(array.shift(zones))",
            ].join("\n"),
        );
        expect(scaffold.handleRings).toEqual([{ name: "zones", kind: "rectangle", cap: 10 }]);
    });
});

describe("transformCampB — label ring honours yloc", () => {
    it("approximates yloc.abovebar and raises yloc-padding-approximated", () => {
        const { scaffold, diagnostics } = runCampB(
            [
                "var tags = array.new_label()",
                'array.push(tags, label.new(bar_index, close, "hi", yloc=yloc.abovebar))',
                "if array.size(tags) > 10",
                "    label.delete(array.shift(tags))",
            ].join("\n"),
        );
        expect(scaffold.handleRings).toEqual([{ name: "tags", kind: "text", cap: 10 }]);
        expect(diagnostics.has("pine-converter/transform/yloc-padding-approximated")).toBe(true);
    });

    it("emits the yloc-padding-approximated diagnostic only once across two label rings", () => {
        const { diagnostics } = runCampB(
            [
                "var tags = array.new_label()",
                'array.push(tags, label.new(bar_index, close, "hi", yloc=yloc.abovebar))',
                "if array.size(tags) > 10",
                "    label.delete(array.shift(tags))",
                "var notes = array.new_label()",
                'array.push(notes, label.new(bar_index, close, "yo", yloc=yloc.abovebar))',
                "if array.size(notes) > 10",
                "    label.delete(array.shift(notes))",
            ].join("\n"),
        );
        const padding = diagnostics
            .toArray()
            .filter((d) => d.code === "pine-converter/transform/yloc-padding-approximated");
        expect(padding).toHaveLength(1);
    });
});
