// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { Declaration } from "../ast/script.js";
import type { Diagnostic } from "../index.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { analyze } from "../semantic/index.js";
import { transformCampC } from "./campC.js";
import { transformDeclaration } from "./declaration.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";

type ConvertibleDecl = Extract<
    Declaration,
    { kind: "indicator-declaration" | "strategy-declaration" }
>;

const HEURISTIC_CODE = "pine-converter/transform/camp-c-heuristic-applied";
const REJECT_CODES: readonly string[] = [
    "pine-converter/semantic/unbounded-handle-collection",
    "pine-converter/transform/dynamic-handle-index",
    "pine-converter/transform/cross-collection-linefill",
    "pine-converter/transform/polyline-dynamic-points",
    "pine-converter/transform/handle-copy",
    "pine-converter/transform/handle-store-in-udt",
    "pine-converter/transform/for-in-line-all",
];

// A fixture builder for a single Camp C site: either a capped collection
// (folds via H1) or an uncapped nested collection (hard rejects).
function buildFixture(cap: number | null): string {
    const header =
        cap === null
            ? 'indicator("X", overlay=true)'
            : `indicator("X", overlay=true, max_lines_count=${cap})`;
    const body =
        cap === null
            ? [
                  "if close > open",
                  "    var lvls = array.new_line()",
                  "    array.push(lvls, line.new(bar_index, close, bar_index, close))",
              ]
            : [
                  "var lvls = array.new_line()",
                  "if close > open",
                  "    array.push(lvls, line.new(bar_index, close, bar_index, close))",
              ];
    return `//@version=6\n${header}\n${body.join("\n")}\nplot(close)\n`;
}

function diagnosticsFor(src: string): readonly Diagnostic[] {
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
    const before = diagnostics.size;
    for (const site of analysis.drawingSites) {
        if (site.camp.kind === "camp-c-bounded" || site.camp.kind === "camp-c-unbounded") {
            transformCampC(site, analysis, scaffold, diagnostics);
        }
    }
    return diagnostics.toArray().slice(before);
}

describe("transformCampC — no silent drop", () => {
    it("yields exactly one heuristic-applied info OR one reject per Camp C site", () => {
        fc.assert(
            fc.property(fc.option(fc.integer({ min: 1, max: 400 }), { nil: null }), (cap) => {
                const produced = diagnosticsFor(buildFixture(cap));
                const applied = produced.filter((d) => d.code === HEURISTIC_CODE).length;
                const rejects = produced.filter((d) => REJECT_CODES.includes(d.code)).length;
                if (cap === null) {
                    // Uncapped, nested collection: no fold possible → one reject.
                    expect(applied).toBe(0);
                    expect(rejects).toBe(1);
                } else {
                    // Capped collection: H1 folds → one info, no reject.
                    expect(applied).toBe(1);
                    expect(rejects).toBe(0);
                }
            }),
            { numRuns: 50 },
        );
    });
});
