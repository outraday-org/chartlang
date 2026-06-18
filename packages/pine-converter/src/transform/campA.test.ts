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

    it("registers exactly one compact line handle slot", () => {
        const { scaffold } = runCampA(body);
        expect(scaffold.handleSlots).toEqual([{ name: "lvl", kind: "line", compact: true }]);
    });

    it("emits one compact const create with mapped color + width", () => {
        const { scaffold } = runCampA(body);
        const create = scaffold.computeBody.statements[0];
        // Compact lowering: the bare `const` create exploits callsite-persistence
        // — no `current() === null` guard, no `set(...)` slot indirection.
        expect(create).toContain("const lvl = draw.line(");
        expect(create).not.toContain("current()");
        expect(create).toContain('color: "#FF5252"');
        expect(create).toContain("lineWidth: 2");
    });

    it("folds the setters via a compact update (no slot indirection)", () => {
        const { scaffold } = runCampA(body);
        const update = scaffold.computeBody.statements.find((s) => s.includes(".update("));
        expect(update).toContain("lvl.update(");
        expect(update).not.toContain("current()");
    });

    it("folds the two setters into one anchors update", () => {
        const { scaffold } = runCampA(body);
        const updates = scaffold.computeBody.statements.filter((s) => s.includes(".update("));
        expect(updates).toHaveLength(1);
        expect(updates[0]).toContain("anchors: [");
        expect(updates[0]).toContain("bar.point((5), bar.close * 1.01)");
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
        expect(scaffold.handleSlots).toEqual([{ name: "lbl", kind: "frame", compact: true }]);
        expect(scaffold.computeBody.statements[0]).toContain("const lbl = draw.frame(");
    });

    it("maps a plain label.new to draw.text with the literal body", () => {
        const { scaffold } = runCampA(
            [
                "var label lbl = na",
                "if barstate.islast",
                '    lbl := label.new(bar_index, high, "Hi")',
            ].join("\n"),
        );
        expect(scaffold.handleSlots).toEqual([{ name: "lbl", kind: "text", compact: true }]);
        expect(scaffold.computeBody.statements[0]).toContain(
            'const lbl = draw.text(bar.point(0, bar.high), "Hi")',
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
        expect(scaffold.handleSlots).toEqual([{ name: "lbl", kind: "marker", compact: true }]);
        expect(scaffold.computeBody.statements[0]).toContain("const lbl = draw.marker(");
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
        expect(scaffold.handleSlots).toEqual([{ name: "bx", kind: "rectangle", compact: true }]);
        const create = scaffold.computeBody.statements[0];
        expect(create).toContain("const bx = draw.rectangle(");
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

describe("transformCampA — delete forces the general slot machinery", () => {
    const body = [
        "var line lvl = na",
        "if barstate.islast",
        "    lvl := line.new(bar_index, close, bar_index, close)",
        "    line.set_xy1(lvl, bar_index, close)",
        "if barstate.isfirst",
        "    line.delete(lvl)",
    ].join("\n");

    it("marks the slot non-compact when the handle is deleted", () => {
        const { scaffold } = runCampA(body);
        expect(scaffold.handleSlots).toEqual([{ name: "lvl", kind: "line", compact: false }]);
    });

    it("emits the guarded create + set/remove slot form, not a bare const", () => {
        const { scaffold } = runCampA(body);
        const create = scaffold.computeBody.statements[0];
        expect(create).toContain("lvl.current() === null");
        expect(create).toContain("lvl.set(draw.line(");
        const stmts = scaffold.computeBody.statements;
        expect(stmts.some((s) => s.includes("lvl.current()?.update("))).toBe(true);
        expect(stmts.some((s) => s.includes("lvl.current()?.remove()"))).toBe(true);
        expect(stmts.some((s) => s.includes("lvl.set(null)"))).toBe(true);
    });
});

describe("transformCampA — varip forces the general slot machinery", () => {
    it("marks a varip handle non-compact and keeps the slot form", () => {
        const { scaffold, diagnostics } = runCampA(
            [
                "varip line lvl = na",
                "if barstate.islast",
                "    lvl := line.new(bar_index, close, bar_index, close)",
                "    line.set_xy2(lvl, bar_index, close)",
            ].join("\n"),
        );
        expect(scaffold.handleSlots).toEqual([{ name: "lvl", kind: "line", compact: false }]);
        expect(scaffold.computeBody.statements[0]).toContain("lvl.current() === null");
        const codes = diagnostics.toArray().map((d) => d.code);
        expect(codes.some((c) => c.endsWith("varip-approximated"))).toBe(true);
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
