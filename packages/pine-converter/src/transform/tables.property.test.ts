// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { analyze } from "../semantic/index.js";
import { transformDeclaration } from "./declaration.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import { transformTables } from "./tables.js";

function cellsSourceFor(body: string): string {
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
    const stmt = scaffold.computeBody.statements.find((s) =>
        s.startsWith("const __t_handle_cells"),
    );
    if (stmt === undefined) {
        throw new Error("no cells statement");
    }
    return stmt;
}

// Count top-level `[...]` row groups in the rendered cells array, and the
// cells (`{ ... }`) within each row.
function gridDimensions(source: string): { rows: number; columns: number } {
    const inner = source.slice(source.indexOf("[[") + 1, source.lastIndexOf("]]") + 1);
    const rowMatches = inner.match(/\[[^[\]]*\]/g) ?? [];
    const rows = rowMatches.length;
    const columns = rows === 0 ? 0 : (rowMatches[0].match(/\{/g) ?? []).length;
    return { rows, columns };
}

describe("transformTables — property: grid dimensions", () => {
    it("emits exactly rows × columns cells", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 6 }),
                fc.integer({ min: 1, max: 6 }),
                (cols, rows) => {
                    const body = [
                        "var table t = na",
                        "if barstate.islast",
                        `    t := table.new(position.top_right, ${cols}, ${rows})`,
                        '    table.cell(t, 0, 0, "x")',
                    ].join("\n");
                    const dims = gridDimensions(cellsSourceFor(body));
                    expect(dims.rows).toBe(rows);
                    expect(dims.columns).toBe(cols);
                },
            ),
        );
    });
});

describe("transformTables — property: last-write-wins", () => {
    it("keeps only the final write's text for a cell", () => {
        fc.assert(
            fc.property(
                fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 1, maxLength: 5 }),
                (values) => {
                    const writes = values.map((v) => `    table.cell(t, 0, 0, "v${v}")`).join("\n");
                    const body = [
                        "var table t = na",
                        "if barstate.islast",
                        "    t := table.new(position.top_right, 1, 1)",
                        writes,
                    ].join("\n");
                    const source = cellsSourceFor(body);
                    const last = values[values.length - 1];
                    expect(source).toContain(`text: "v${last}"`);
                },
            ),
        );
    });
});
