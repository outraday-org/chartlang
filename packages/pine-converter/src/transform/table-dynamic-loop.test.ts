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

describe("transformTables — dynamic loop bounds", () => {
    it("errors when a cell-writing loop has a non-literal bound", () => {
        const { diagnostics } = runTables(
            [
                "len = 3",
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_right, 1, 10)",
                "    for i = 0 to len",
                '        table.cell(t, 0, i, "row")',
            ].join("\n"),
        );
        expect(codes(diagnostics)).toContain("pine-converter/transform/table-dynamic-loop");
    });

    it("ignores a loop that does not write the table handle", () => {
        const { diagnostics } = runTables(
            [
                "len = 3",
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_right, 1, 1)",
                '    table.cell(t, 0, 0, "x")',
                "    for i = 0 to len",
                "        plot(close)",
            ].join("\n"),
        );
        expect(codes(diagnostics)).not.toContain("pine-converter/transform/table-dynamic-loop");
    });

    it("unrolls a literal-bounded loop without error", () => {
        const { scaffold, diagnostics } = runTables(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_right, 1, 3)",
                "    for i = 0 to 2",
                '        table.cell(t, 0, i, "r" + str.tostring(i))',
            ].join("\n"),
        );
        expect(codes(diagnostics)).not.toContain("pine-converter/transform/table-dynamic-loop");
        const cellsStmt = scaffold.computeBody.statements.find((s) =>
            s.startsWith("const __t_handle_cells"),
        );
        expect(cellsStmt).toContain('text: "r" + str.tostring(0)');
        expect(cellsStmt).toContain('text: "r" + str.tostring(2)');
    });

    it("errors when a cell-writing loop has a zero `by` step", () => {
        const { diagnostics } = runTables(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_right, 1, 3)",
                "    for i = 0 to 2 by 0",
                '        table.cell(t, 0, i, "x")',
            ].join("\n"),
        );
        expect(codes(diagnostics)).toContain("pine-converter/transform/table-dynamic-loop");
    });

    it("errors when a cell-writing loop has a non-literal `by` step", () => {
        const { diagnostics } = runTables(
            [
                "s = 2",
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_right, 1, 3)",
                "    for i = 0 to 2 by s",
                '        table.cell(t, 0, i, "x")',
            ].join("\n"),
        );
        expect(codes(diagnostics)).toContain("pine-converter/transform/table-dynamic-loop");
    });

    it("unrolls a stepped ascending loop using the `by` magnitude", () => {
        const { scaffold } = runTables(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_right, 1, 5)",
                "    for i = 0 to 4 by 2",
                '        table.cell(t, 0, i, "r" + str.tostring(i))',
            ].join("\n"),
        );
        const cellsStmt = scaffold.computeBody.statements.find((s) =>
            s.startsWith("const __t_handle_cells"),
        );
        expect(cellsStmt).toContain('text: "r" + str.tostring(0)');
        expect(cellsStmt).toContain('text: "r" + str.tostring(2)');
        expect(cellsStmt).toContain('text: "r" + str.tostring(4)');
        expect(cellsStmt).not.toContain('text: "r" + str.tostring(1)');
    });

    it("unrolls a descending loop in descending order", () => {
        const { scaffold } = runTables(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_right, 1, 3)",
                "    for i = 2 to 0",
                '        table.cell(t, 0, i, "r" + str.tostring(i))',
            ].join("\n"),
        );
        const cellsStmt = scaffold.computeBody.statements.find((s) =>
            s.startsWith("const __t_handle_cells"),
        );
        expect(cellsStmt).toContain('text: "r" + str.tostring(0)');
        expect(cellsStmt).toContain('text: "r" + str.tostring(2)');
    });
});
