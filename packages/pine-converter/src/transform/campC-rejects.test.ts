// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { Declaration } from "../ast/script.js";
import type { Diagnostic } from "../index.js";
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

function runCampC(body: string): {
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
        transformCampC(site, analysis, scaffold, diagnostics);
    }
    return { scaffold, diagnostics };
}

function errorOf(diagnostics: DiagnosticCollector, code: string): Diagnostic {
    const match = diagnostics.toArray().find((d) => d.code === `pine-converter/transform/${code}`);
    if (match === undefined) {
        throw new Error(`expected a ${code} diagnostic`);
    }
    return match;
}

describe("transformCampC — unbounded-handle-collection reject", () => {
    // A collection declared only inside an `if` does not resolve at the root
    // scope, has no cap, and so cannot fold — the canonical hard reject.
    const UNBOUNDED = [
        "if close > open",
        "    var lvls = array.new_line()",
        "    array.push(lvls, line.new(bar_index, close, bar_index, close))",
    ].join("\n");

    it("rejects with a suggestion mentioning max_lines_count and a size-gate", () => {
        const { diagnostics } = runCampC(UNBOUNDED);
        const diag = diagnostics
            .toArray()
            .find(
                (d) =>
                    d.code === "pine-converter/semantic/unbounded-handle-collection" &&
                    d.suggestion !== undefined &&
                    d.suggestion.includes("array.shift"),
            );
        if (diag === undefined) {
            throw new Error("expected a transform unbounded-handle-collection reject");
        }
        expect(diag.severity).toBe("error");
        expect(diag.suggestion).toContain("max_lines_count");
        expect(diag.suggestion).toContain("array.shift");
    });

    it("emits a HARD-REJECT comment in the compute body", () => {
        const { scaffold } = runCampC(UNBOUNDED);
        const comment = scaffold.computeBody.statements.find((s) =>
            s.includes("HARD-REJECT (unbounded-handle-collection)"),
        );
        expect(comment).toBeDefined();
        expect(comment).toContain("line.new(...)");
    });

    it("registers no ring for an unbounded collection", () => {
        const { scaffold } = runCampC(UNBOUNDED);
        expect(scaffold.handleRings).toEqual([]);
    });
});

describe("transformCampC — cross-collection-linefill reject", () => {
    const LINEFILL = [
        "var a = array.new_line()",
        "var b = array.new_line()",
        "lf = linefill.new(array.get(a, 0), array.get(b, 0), color.red)",
    ].join("\n");

    it("rejects with the draw.path suggestion", () => {
        const { diagnostics } = runCampC(LINEFILL);
        const diag = errorOf(diagnostics, "cross-collection-linefill");
        expect(diag.suggestion).toContain("draw.path");
    });

    it("anchors the reject comment at the linefill site", () => {
        const { scaffold } = runCampC(LINEFILL);
        const comment = scaffold.computeBody.statements.find((s) =>
            s.includes("HARD-REJECT (cross-collection-linefill)"),
        );
        expect(comment).toBeDefined();
        expect(comment).toContain("linefill.new(...)");
    });
});

describe("transformCampC — continues past a reject", () => {
    it("emits one reject per offending site without halting", () => {
        const { diagnostics } = runCampC(
            [
                "var a = array.new_line()",
                "var b = array.new_line()",
                "lf1 = linefill.new(array.get(a, 0), array.get(b, 0), color.red)",
                "lf2 = linefill.new(array.get(a, 1), array.get(b, 1), color.red)",
            ].join("\n"),
        );
        const rejects = diagnostics
            .toArray()
            .filter((d) => d.code === "pine-converter/transform/cross-collection-linefill");
        expect(rejects).toHaveLength(2);
    });
});
