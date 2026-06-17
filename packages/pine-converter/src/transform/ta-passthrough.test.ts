// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { Declaration } from "../ast/script.js";
import { lex } from "../lexer/index.js";
import { TA_PASSTHROUGH_MAP } from "../mapping/index.js";
import { parseStatements } from "../parser/index.js";
import { analyze } from "../semantic/index.js";
import { transformDeclaration } from "./declaration.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import { transformInputs } from "./inputs.js";
import { transformOther } from "./other.js";

type ConvertibleDecl = Extract<
    Declaration,
    { kind: "indicator-declaration" | "strategy-declaration" }
>;

function run(body: string): { statements: readonly string[]; codes: string[] } {
    const src = `//@version=6\nindicator("X")\n${body}\n`;
    const analysis = analyze(parseStatements(lex(src).tokens).script);
    const decl = analysis.script.declaration as ConvertibleDecl;
    const diagnostics = new DiagnosticCollector();
    const scaffold = transformDeclaration(decl, analysis, diagnostics);
    transformInputs(analysis, scaffold, diagnostics);
    transformOther(analysis, scaffold, diagnostics);
    return {
        statements: scaffold.computeBody.statements,
        codes: diagnostics.toArray().map((d) => d.code),
    };
}

describe("ta.* passthrough", () => {
    it("maps a clean ta.* member through with arg passthrough", () => {
        expect(run("x = ta.ema(close, 9)\nplot(x)").statements[0]).toBe(
            "let x = ta.ema(bar.close, 9);",
        );
    });

    it("maps every non-null TA_PASSTHROUGH_MAP entry to its chartlang member", () => {
        for (const [pine, mapping] of TA_PASSTHROUGH_MAP) {
            if (mapping.chartlang === null) {
                continue;
            }
            const { statements } = run(`x = ${pine}(close, 9)\nplot(x)`);
            expect(statements[0]).toBe(`let x = ${mapping.chartlang}(bar.close, 9);`);
        }
    });

    it("warns ta-signature-divergence for an entry with a signatureNote", () => {
        const { statements, codes } = run("x = ta.rma(close, 9)\nplot(x)");
        expect(statements[0]).toBe("let x = ta.smma(bar.close, 9);");
        expect(codes).toContain("pine-converter/transform/ta-signature-divergence");
    });

    it("warns ta-not-mapped + leaves a TODO marker for a REJECT entry", () => {
        const { statements, codes } = run("x = ta.kcw(close, 9)\nplot(x)");
        expect(statements[0]).toContain("/* TODO unmapped */");
        expect(codes).toContain("pine-converter/transform/ta-not-mapped");
    });

    it("warns ta-not-mapped for an unknown ta.* member", () => {
        const { codes } = run("x = ta.notathing(close)\nplot(x)");
        expect(codes).toContain("pine-converter/transform/ta-not-mapped");
    });

    it("lowers a ta.* call used directly as a plot argument", () => {
        expect(run("plot(ta.sma(close, 14))").statements[0]).toBe("plot(ta.sma(bar.close, 14));");
    });
});
