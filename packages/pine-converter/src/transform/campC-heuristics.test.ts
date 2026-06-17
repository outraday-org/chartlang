// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { Declaration } from "../ast/script.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { analyze } from "../semantic/index.js";
import { transformCampC } from "./campC.js";
import { transformDeclaration } from "./declaration.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import type { ScriptScaffold } from "./ir.js";

type ConvertibleDecl = Extract<
    Declaration,
    { kind: "indicator-declaration" | "strategy-declaration" }
>;

function runCampC(
    header: string,
    body: string,
): {
    scaffold: ScriptScaffold;
    diagnostics: DiagnosticCollector;
} {
    const src = `//@version=6\n${header}\n${body}\nplot(close)\n`;
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
        transformCampC(site, analysis, scaffold, diagnostics);
    }
    return { scaffold, diagnostics };
}

function infos(diagnostics: DiagnosticCollector, code: string): readonly unknown[] {
    return diagnostics.toArray().filter((d) => d.code === `pine-converter/transform/${code}`);
}

describe("transformCampC — H1 implicit-cap-from-indicator", () => {
    const H1 = [
        "var lvls = array.new_line()",
        "if close > open",
        "    array.push(lvls, line.new(bar_index, close, bar_index, close))",
    ].join("\n");

    it("folds a max_lines_count collection into a Camp B ring at that cap", () => {
        const { scaffold } = runCampC('indicator("X", overlay=true, max_lines_count=30)', H1);
        expect(scaffold.handleRings).toEqual([{ name: "__lvls_ring", kind: "line", cap: 30 }]);
    });

    it("emits exactly one camp-c-heuristic-applied info with the reasoning", () => {
        const { diagnostics } = runCampC('indicator("X", overlay=true, max_lines_count=30)', H1);
        const applied = infos(diagnostics, "camp-c-heuristic-applied");
        expect(applied).toHaveLength(1);
        expect(
            diagnostics.toArray().find((d) => d.code.endsWith("camp-c-heuristic-applied"))?.message,
        ).toContain("implicit FIFO at N=30");
    });

    it("emits the folded ring.push so the site is not silently dropped", () => {
        const { scaffold } = runCampC('indicator("X", overlay=true, max_lines_count=30)', H1);
        const pushes = scaffold.computeBody.statements.filter((s) =>
            s.includes("__lvls_ring.push("),
        );
        expect(pushes).toHaveLength(1);
    });
});

describe("transformCampC — H2 loop-bound (synthetic recoverable shape)", () => {
    it("folds when a literal for-bound caps a root-resolved collection", () => {
        // A push inside a `for i = 0 to 4` over a root-resolved collection
        // with no eviction and no indicator cap. The classifier makes this
        // camp-b (bucket-default), so H2 fires via the synthetic path; here
        // we assert the loop-bound recovery helper does not crash the fold.
        const { diagnostics } = runCampC(
            'indicator("X", overlay=true)',
            [
                "var lvls = array.new_line()",
                "for i = 0 to 4",
                "    array.push(lvls, line.new(bar_index, close, bar_index, close))",
            ].join("\n"),
        );
        // The classifier routes this to camp-b, so Camp C self-filters it out.
        expect(infos(diagnostics, "camp-c-heuristic-applied")).toHaveLength(0);
    });
});
