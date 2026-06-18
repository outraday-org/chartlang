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

describe("varip handle", () => {
    it("reuses the handle slot and emits varip-approximated", () => {
        const { scaffold, diagnostics } = runCampA(
            [
                "varip line lvl = na",
                "if barstate.islast",
                "    lvl := line.new(bar_index, close, bar_index, close)",
            ].join("\n"),
        );
        expect(scaffold.handleSlots).toEqual([{ name: "lvl", kind: "line", compact: false }]);
        const codes = diagnostics.toArray().map((d) => d.code);
        expect(codes.some((c) => c.endsWith("varip-approximated"))).toBe(true);
    });

    it("does not emit varip-approximated for a plain var handle", () => {
        const { diagnostics } = runCampA(
            [
                "var line lvl = na",
                "if barstate.islast",
                "    lvl := line.new(bar_index, close, bar_index, close)",
            ].join("\n"),
        );
        const codes = diagnostics.toArray().map((d) => d.code);
        expect(codes.some((c) => c.endsWith("varip-approximated"))).toBe(false);
    });
});

describe("cross-mount state", () => {
    it("emits cross-mount-state-not-preserved when the var initial is non-na", () => {
        const { diagnostics } = runCampA(
            [
                "var line lvl = line.new(bar_index, close, bar_index, close)",
                "if barstate.islast",
                "    line.set_color(lvl, color.red)",
            ].join("\n"),
        );
        const codes = diagnostics.toArray().map((d) => d.code);
        expect(codes.some((c) => c.endsWith("cross-mount-state-not-preserved"))).toBe(true);
    });
});
