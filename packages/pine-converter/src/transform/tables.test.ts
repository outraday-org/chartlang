// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { analyze } from "../semantic/index.js";
import { transformDeclaration } from "./declaration.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import type { ScriptScaffold } from "./ir.js";
import { transformTables } from "./tables.js";

function runTables(body: string): { scaffold: ScriptScaffold; diagnostics: DiagnosticCollector } {
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
    transformTables(analysis, scaffold, diagnostics);
    return { scaffold, diagnostics };
}

const codes = (d: DiagnosticCollector): string[] => d.toArray().map((x) => x.code);

describe("transformTables — canonical dashboard", () => {
    const dashboard = [
        "var table dash = na",
        "if barstate.islast",
        "    dash := table.new(position.top_right, 2, 5)",
        "    for i = 0 to 4",
        '        table.cell(dash, 0, i, "Row " + str.tostring(i))',
        "        table.cell(dash, 1, i, str.tostring(close[i]))",
    ].join("\n");

    it("registers a table handle slot", () => {
        const { scaffold } = runTables(dashboard);
        expect(scaffold.handleSlots).toEqual([{ name: "dash", kind: "table", compact: false }]);
    });

    it("emits a 5-row × 2-column cells array", () => {
        const { scaffold } = runTables(dashboard);
        const cellsStmt = scaffold.computeBody.statements.find((s) =>
            s.startsWith("const dashCells"),
        );
        expect(cellsStmt).toBeDefined();
        // 5 rows, each a 2-element array.
        expect(cellsStmt).toContain('text: "Row " + String(0)');
        expect(cellsStmt).toContain("text: String(bar.close[4])");
    });

    it("gates the draw.table rebuild behind barstate.islast", () => {
        const { scaffold } = runTables(dashboard);
        const drawStmt = scaffold.computeBody.statements.find((s) => s.includes("draw.table"));
        expect(drawStmt).toContain("if (barstate.islast)");
        expect(drawStmt).toContain('position: "top-right"');
        expect(drawStmt).toContain("dash.current()?.remove();");
        expect(drawStmt).toContain("dash.set(draw.table(");
        expect(drawStmt).toContain("cells: dashCells");
    });

    it("raises the other bucket cap to the table count + 1", () => {
        const { scaffold, diagnostics } = runTables(dashboard);
        expect(scaffold.maxDrawings.other).toBe(2);
        expect(codes(diagnostics)).toContain("pine-converter/transform/table-bucket-cap-adjusted");
    });
});

describe("transformTables — cell styling + last-write-wins", () => {
    it("maps cell styling args + enums onto the chartlang cell", () => {
        const { scaffold } = runTables(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.bottom_left, 1, 1)",
                '    table.cell(t, 0, 0, "P&L", bgcolor=color.green, text_color=color.white, text_halign=text.align_right, text_size=size.large)',
            ].join("\n"),
        );
        const cellsStmt = scaffold.computeBody.statements.find((s) => s.startsWith("const tCells"));
        expect(cellsStmt).toContain('text: "P&L"');
        expect(cellsStmt).toContain('bgColor: "#4CAF50"');
        expect(cellsStmt).toContain('textColor: "#FFFFFF"');
        expect(cellsStmt).toContain('textHalign: "right"');
        expect(cellsStmt).toContain('textSize: "large"');
        const drawStmt = scaffold.computeBody.statements.find((s) => s.includes("draw.table"));
        expect(drawStmt).toContain('position: "bottom-left"');
    });

    it("lets the last write to a cell win", () => {
        const { scaffold } = runTables(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 1, 1)",
                '    table.cell(t, 0, 0, "first")',
                '    table.cell(t, 0, 0, "second")',
            ].join("\n"),
        );
        const cellsStmt = scaffold.computeBody.statements.find((s) => s.startsWith("const tCells"));
        expect(cellsStmt).toContain('text: "second"');
        expect(cellsStmt).not.toContain('text: "first"');
    });

    it("folds cell_set_* setters onto the collected cell", () => {
        const { scaffold } = runTables(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 1, 1)",
                '    table.cell(t, 0, 0, "x")',
                "    table.cell_set_bgcolor(t, 0, 0, color.red)",
                '    table.cell_set_text(t, 0, 0, "y")',
                "    table.cell_set_text_valign(t, 0, 0, text.align_top)",
            ].join("\n"),
        );
        const cellsStmt = scaffold.computeBody.statements.find((s) => s.startsWith("const tCells"));
        expect(cellsStmt).toContain('text: "y"');
        expect(cellsStmt).toContain('bgColor: "#FF5252"');
        expect(cellsStmt).toContain('textValign: "top"');
    });

    it("folds a transparency-carrying cell colour to a #RRGGBBAA hex", () => {
        const { scaffold, diagnostics } = runTables(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 1, 1)",
                '    table.cell(t, 0, 0, "x", bgcolor=color.new(color.green, 80), text_color=color.rgb(255, 153, 0, 60))',
            ].join("\n"),
        );
        const cellsStmt = scaffold.computeBody.statements.find((s) => s.startsWith("const tCells"));
        expect(cellsStmt).toContain('bgColor: "#4CAF5033"');
        expect(cellsStmt).toContain('textColor: "#FF990066"');
        expect(codes(diagnostics)).toContain("pine-converter/transform/color-transp-approximated");
    });

    it("lowers a dynamic-base cell colour via cell_set_bgcolor to color.withAlpha", () => {
        const { scaffold, diagnostics } = runTables(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 1, 1)",
                '    table.cell(t, 0, 0, "x")',
                "    table.cell_set_bgcolor(t, 0, 0, color.new(myColor, 80))",
            ].join("\n"),
        );
        const cellsStmt = scaffold.computeBody.statements.find((s) => s.startsWith("const tCells"));
        expect(cellsStmt).toContain("bgColor: color.withAlpha(myColor, 0.2)");
        expect(codes(diagnostics)).toContain("pine-converter/transform/color-transp-approximated");
    });
});

describe("transformTables — clear + empty cells", () => {
    it("treats table.clear as a no-op with an info diagnostic", () => {
        const { diagnostics } = runTables(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 1, 1)",
                '    table.cell(t, 0, 0, "x")',
                "    table.clear(t, 0, 0, 0, 0)",
            ].join("\n"),
        );
        expect(codes(diagnostics)).toContain("pine-converter/transform/table-clear-noop");
    });

    it("renders absent cells as empty-string cells", () => {
        const { scaffold } = runTables(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_left, 2, 1)",
                '    table.cell(t, 0, 0, "only")',
            ].join("\n"),
        );
        const cellsStmt = scaffold.computeBody.statements.find((s) => s.startsWith("const tCells"));
        expect(cellsStmt).toContain('text: "only"');
        expect(cellsStmt).toContain('{ text: "" }');
    });

    it("does nothing when the script declares no table", () => {
        const { scaffold, diagnostics } = runTables("plot(close)");
        expect(scaffold.handleSlots).toEqual([]);
        expect(diagnostics.size).toBe(0);
    });
});
