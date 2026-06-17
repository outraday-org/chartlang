// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { analyze } from "../semantic/index.js";
import { transformDeclaration } from "./declaration.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import { transformTables } from "./tables.js";

function runTables(body: string): DiagnosticCollector {
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
    return diagnostics;
}

const codes = (d: DiagnosticCollector): string[] => d.toArray().map((x) => x.code);

describe("transformTables — out-of-bounds writes", () => {
    it("errors on a column past the declared count", () => {
        const diagnostics = runTables(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_right, 2, 1)",
                '    table.cell(t, 2, 0, "oops")',
            ].join("\n"),
        );
        expect(codes(diagnostics)).toContain("pine-converter/transform/table-cell-out-of-bounds");
    });

    it("errors on a row past the declared count", () => {
        const diagnostics = runTables(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_right, 1, 2)",
                '    table.cell(t, 0, 5, "oops")',
            ].join("\n"),
        );
        expect(codes(diagnostics)).toContain("pine-converter/transform/table-cell-out-of-bounds");
    });

    it("accepts an in-bounds write", () => {
        const diagnostics = runTables(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_right, 2, 2)",
                '    table.cell(t, 1, 1, "ok")',
            ].join("\n"),
        );
        expect(codes(diagnostics)).not.toContain(
            "pine-converter/transform/table-cell-out-of-bounds",
        );
    });
});
