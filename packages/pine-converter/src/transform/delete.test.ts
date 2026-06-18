// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { analyze } from "../semantic/index.js";
import { transformCampA } from "./campA.js";
import { transformDeclaration } from "./declaration.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import type { ScriptScaffold } from "./ir.js";

function runCampA(body: string): { scaffold: ScriptScaffold; diagnostics: DiagnosticCollector } {
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
    for (const site of analysis.drawingSites) {
        if (site.camp.kind === "camp-a") {
            transformCampA(site, analysis, scaffold, diagnostics);
        }
    }
    return { scaffold, diagnostics };
}

describe("delete translation", () => {
    it("emits remove() + slot reset for line.delete", () => {
        const { scaffold } = runCampA(
            [
                "var line lvl = na",
                "if barstate.islast",
                "    lvl := line.new(bar_index, close, bar_index, close)",
                "if done",
                "    line.delete(lvl)",
            ].join("\n"),
        );
        const stmts = scaffold.computeBody.statements;
        expect(stmts).toContain("lvl.current()?.remove();");
        expect(stmts).toContain("lvl.set(null);");
        // remove precedes the slot reset.
        expect(stmts.indexOf("lvl.current()?.remove();")).toBeLessThan(
            stmts.indexOf("lvl.set(null);"),
        );
    });
});

describe("cross-branch folding", () => {
    it("emits one update per branch and a cross-branch info", () => {
        const { scaffold, diagnostics } = runCampA(
            [
                "var label lbl = na",
                "if barstate.islast",
                "    lbl := label.new(bar_index, high)",
                "if up",
                "    label.set_color(lbl, color.green)",
                "else",
                "    label.set_color(lbl, color.red)",
            ].join("\n"),
        );
        const updates = scaffold.computeBody.statements.filter((s) => s.includes(".update("));
        expect(updates).toHaveLength(2);
        const codes = diagnostics.toArray().map((d) => d.code);
        expect(codes.some((c) => c.endsWith("setter-fold-cross-branch"))).toBe(true);
    });
});
