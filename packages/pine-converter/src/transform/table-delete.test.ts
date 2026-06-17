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

function runTables(body: string): ScriptScaffold {
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
    return scaffold;
}

describe("transformTables — table.delete", () => {
    it("emits the slot-clear pattern at a delete site", () => {
        const scaffold = runTables(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_right, 1, 1)",
                '    table.cell(t, 0, 0, "x")',
                "if barstate.isfirst",
                "    table.delete(t)",
            ].join("\n"),
        );
        const statements = scaffold.computeBody.statements;
        expect(statements).toContain("__t_handle.current()?.remove();");
        expect(statements).toContain("__t_handle.set(null);");
    });

    it("does not emit slot-clear when there is no delete", () => {
        const scaffold = runTables(
            [
                "var table t = na",
                "if barstate.islast",
                "    t := table.new(position.top_right, 1, 1)",
                '    table.cell(t, 0, 0, "x")',
            ].join("\n"),
        );
        expect(scaffold.computeBody.statements).not.toContain("__t_handle.set(null);");
    });
});
