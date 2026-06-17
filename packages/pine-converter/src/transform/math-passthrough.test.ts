// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { Declaration } from "../ast/script.js";
import { lex } from "../lexer/index.js";
import { MATH_PASSTHROUGH_MAP } from "../mapping/index.js";
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

describe("math.* passthrough", () => {
    it("maps a 1:1 math.* member to Math.*", () => {
        expect(run("x = math.abs(close)\nplot(x)").statements[0]).toBe(
            "let x = Math.abs(bar.close);",
        );
    });

    it("maps every non-null MATH_PASSTHROUGH_MAP entry to its chartlang member", () => {
        for (const [pine, mapping] of MATH_PASSTHROUGH_MAP) {
            if (mapping.chartlang === null) {
                continue;
            }
            const { statements } = run(`x = ${pine}(close)\nplot(x)`);
            expect(statements[0]).toBe(`let x = ${mapping.chartlang}(bar.close);`);
        }
    });

    it("warns math-not-mapped + REJECT for math.random", () => {
        const { statements, codes } = run("x = math.random()\nplot(close)");
        expect(statements[0]).toContain("/* TODO unmapped */");
        expect(codes).toContain("pine-converter/transform/math-not-mapped");
    });

    it("warns math-not-mapped + REJECT for math.round_to_mintick", () => {
        const { codes } = run("x = math.round_to_mintick(close)\nplot(close)");
        expect(codes).toContain("pine-converter/transform/math-not-mapped");
    });

    it("warns math-not-mapped for an unknown math.* member", () => {
        const { codes } = run("x = math.notathing(close)\nplot(close)");
        expect(codes).toContain("pine-converter/transform/math-not-mapped");
    });
});
