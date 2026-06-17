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

describe("transformTables — merge_cells fallback", () => {
    it("keeps the top-left cell and blanks the rest of the span", () => {
        const { scaffold, diagnostics } = runTables(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_right, 2, 1)",
                '    table.cell(t, 0, 0, "kept")',
                '    table.cell(t, 1, 0, "gone")',
                "    table.merge_cells(t, 0, 0, 1, 0)",
            ].join("\n"),
        );
        const cellsStmt = scaffold.computeBody.statements.find((s) =>
            s.startsWith("const __t_handle_cells"),
        );
        expect(cellsStmt).toContain('text: "kept"');
        expect(cellsStmt).not.toContain('text: "gone"');
        expect(cellsStmt).toContain('{ text: "" }');
        expect(codes(diagnostics)).toContain("pine-converter/transform/table-merge-fallback");
    });

    it("warns even when merge bounds are non-literal", () => {
        const { diagnostics } = runTables(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_right, 2, 1)",
                '    table.cell(t, 0, 0, "x")',
                "    table.merge_cells(t, 0, 0, n, 0)",
            ].join("\n"),
        );
        expect(codes(diagnostics)).toContain("pine-converter/transform/table-merge-fallback");
    });
});
