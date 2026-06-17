// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { Declaration } from "../ast/script.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { type SemanticResult, analyze } from "../semantic/index.js";
import { transformDeclaration } from "./declaration.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import type { ScriptScaffold } from "./ir.js";

type ConvertibleDecl = Extract<
    Declaration,
    { kind: "indicator-declaration" | "strategy-declaration" }
>;

function scaffoldOf(src: string): { scaffold: ScriptScaffold; analysis: SemanticResult } {
    const analysis = analyze(parseStatements(lex(src).tokens).script);
    const decl = analysis.script.declaration;
    if (
        decl === null ||
        decl.kind === "library-declaration" ||
        decl.kind === "import-declaration"
    ) {
        throw new Error("expected an indicator/strategy declaration in the fixture");
    }
    const diagnostics = new DiagnosticCollector();
    const scaffold = transformDeclaration(decl as ConvertibleDecl, analysis, diagnostics);
    return { scaffold, analysis };
}

function indicator(args: string): { scaffold: ScriptScaffold } {
    return scaffoldOf(`//@version=6\nindicator(${args})\nplot(close)\n`);
}

describe("transformDeclaration — indicator args", () => {
    it("maps the acceptance fixture", () => {
        const { scaffold } = indicator('"Hello", overlay=true, max_lines_count=20');
        expect(scaffold.name).toBe("Hello");
        expect(scaffold.overlay).toBe(true);
        expect(scaffold.maxDrawings.lines).toBe(20);
        expect(scaffold.constructor).toBe("defineIndicator");
        expect(scaffold.apiVersion).toBe(1);
    });

    it("starts with empty collections and an empty compute body", () => {
        const { scaffold } = indicator('"X"');
        expect(scaffold.inputs).toEqual([]);
        expect(scaffold.stateSlots).toEqual([]);
        expect(scaffold.handleSlots).toEqual([]);
        expect(scaffold.handleRings).toEqual([]);
        expect(scaffold.computeBody.statements).toEqual([]);
    });

    it("maps shorttitle / format / precision / scale", () => {
        const { scaffold } = indicator(
            '"X", shorttitle="X2", format=format.percent, precision=3, scale=scale.left',
        );
        expect(scaffold.shortName).toBe("X2");
        expect(scaffold.format).toBe("percent");
        expect(scaffold.precision).toBe(3);
        expect(scaffold.scale).toBe("left");
    });

    it("carries maxBarsBack", () => {
        const { scaffold } = indicator('"X", max_bars_back=120');
        expect(scaffold.maxBarsBack).toBe(120);
    });

    it("falls back to <unknown> for a computed title and raises an error", () => {
        const { scaffold } = indicator("syminfo.ticker");
        expect(scaffold.name).toBe("<unknown>");
        expect(scaffold.diagnostics.map((d) => d.code)).toContain(
            "pine-converter/transform/computed-indicator-title",
        );
    });

    it("threads the accumulated diagnostics onto the scaffold", () => {
        const { scaffold } = indicator('"X", timeframe="1D"');
        expect(scaffold.diagnostics.map((d) => d.code)).toContain(
            "pine-converter/transform/indicator-arg-not-mapped",
        );
    });
});
