// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { Declaration } from "../ast/script.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { analyze } from "../semantic/index.js";
import { transformCampA } from "./campA.js";
import { transformDeclaration } from "./declaration.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import type { ScriptScaffold } from "./ir.js";

type ConvertibleDecl = Extract<
    Declaration,
    { kind: "indicator-declaration" | "strategy-declaration" }
>;

function runCampA(body: string): {
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
        if (site.camp.kind === "camp-a") {
            transformCampA(site, analysis, scaffold, diagnostics);
        }
    }
    return { scaffold, diagnostics };
}

describe("transformCampA — var line", () => {
    const body = [
        "var line lvl = na",
        "if barstate.islast",
        "    lvl := line.new(bar_index, close, bar_index, close, color=color.red, width=2)",
        "    line.set_xy1(lvl, bar_index, close * 1.01)",
        "    line.set_xy2(lvl, bar_index + 5, close * 1.01)",
    ].join("\n");

    it("registers exactly one line handle slot", () => {
        const { scaffold } = runCampA(body);
        expect(scaffold.handleSlots).toEqual([{ name: "__lvl_handle", kind: "line" }]);
    });

    it("emits one guarded create with mapped color + width", () => {
        const { scaffold } = runCampA(body);
        const create = scaffold.computeBody.statements[0];
        expect(create).toContain("__lvl_handle.current() === null");
        expect(create).toContain("draw.line(");
        expect(create).toContain('color: "#FF5252"');
        expect(create).toContain("lineWidth: 2");
    });

    it("folds the two setters into one anchors update", () => {
        const { scaffold } = runCampA(body);
        const updates = scaffold.computeBody.statements.filter((s) => s.includes(".update("));
        expect(updates).toHaveLength(1);
        expect(updates[0]).toContain("anchors: [");
        expect(updates[0]).toContain("bar.time + ((5) * __BAR_INTERVAL_MS)");
        expect(updates[0]).toContain("bar.close * 1.01");
    });
});

describe("transformCampA — var label", () => {
    it("maps a label.style_label_down to draw.frame", () => {
        const { scaffold } = runCampA(
            [
                "var label lbl = na",
                "if barstate.islast",
                "    lbl := label.new(bar_index, high, style=label.style_label_down)",
            ].join("\n"),
        );
        expect(scaffold.handleSlots).toEqual([{ name: "__lbl_handle", kind: "frame" }]);
        expect(scaffold.computeBody.statements[0]).toContain("draw.frame(");
    });

    it("maps a plain label.new to draw.text with the literal body", () => {
        const { scaffold } = runCampA(
            [
                "var label lbl = na",
                "if barstate.islast",
                '    lbl := label.new(bar_index, high, "Hi")',
            ].join("\n"),
        );
        expect(scaffold.handleSlots).toEqual([{ name: "__lbl_handle", kind: "text" }]);
        expect(scaffold.computeBody.statements[0]).toContain(
            'draw.text({ time: bar.time, price: bar.high }, "Hi")',
        );
    });

    it("maps a label.style_circle marker", () => {
        const { scaffold } = runCampA(
            [
                "var label lbl = na",
                "if barstate.islast",
                "    lbl := label.new(bar_index, high, style=label.style_circle)",
            ].join("\n"),
        );
        expect(scaffold.handleSlots).toEqual([{ name: "__lbl_handle", kind: "marker" }]);
        expect(scaffold.computeBody.statements[0]).toContain("draw.marker(");
    });
});

describe("transformCampA — var box", () => {
    it("maps box.new to draw.rectangle with mapped border colour", () => {
        const { scaffold } = runCampA(
            [
                "var box bx = na",
                "if barstate.islast",
                "    bx := box.new(bar_index, high, bar_index, low, color=color.blue)",
                "    box.set_bgcolor(bx, color.green)",
            ].join("\n"),
        );
        expect(scaffold.handleSlots).toEqual([{ name: "__bx_handle", kind: "rectangle" }]);
        const create = scaffold.computeBody.statements[0];
        expect(create).toContain("draw.rectangle(");
        expect(create).toContain('stroke: "#2196F3"');
        const update = scaffold.computeBody.statements.find((s) => s.includes(".update("));
        expect(update).toContain('fill: "#4CAF50"');
    });
});

describe("transformCampA — line extend setter", () => {
    it("folds line.set_extend(extend.both) into the style patch", () => {
        const { scaffold } = runCampA(
            [
                "var line lvl = na",
                "if barstate.islast",
                "    lvl := line.new(bar_index, close, bar_index, close)",
                "    line.set_extend(lvl, extend.both)",
            ].join("\n"),
        );
        const update = scaffold.computeBody.statements.find((s) => s.includes(".update("));
        expect(update).toContain("extendLeft: true");
        expect(update).toContain("extendRight: true");
    });
});

describe("transformCampA — guards", () => {
    it("ignores non-camp-a sites passed in", () => {
        // A bounded collection classifies camp-b; transformCampA early-returns.
        const src = [
            "//@version=6",
            'indicator("X", max_lines_count=10)',
            "var lines = array.new<line>()",
            "if barstate.islast",
            "    array.push(lines, line.new(bar_index, close, bar_index, close))",
            "    if array.size(lines) > 10",
            "        line.delete(array.shift(lines))",
            "plot(close)",
            "",
        ].join("\n");
        const analysis = analyze(parseStatements(lex(src).tokens).script);
        const decl = analysis.script.declaration as ConvertibleDecl;
        const diagnostics = new DiagnosticCollector();
        const scaffold = transformDeclaration(decl, analysis, diagnostics);
        const site = analysis.drawingSites[0];
        transformCampA(site, analysis, scaffold, diagnostics);
        expect(scaffold.handleSlots).toEqual([]);
    });
});
