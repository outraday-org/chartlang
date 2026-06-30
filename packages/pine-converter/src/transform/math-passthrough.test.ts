// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { Declaration } from "../ast/script.js";
import { emit } from "../codegen/index.js";
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

function build(body: string): {
    statements: readonly string[];
    codes: string[];
    source: string;
} {
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
        source: emit(scaffold),
    };
}

function run(body: string): { statements: readonly string[]; codes: string[] } {
    const { statements, codes } = build(body);
    return { statements, codes };
}

describe("math.* passthrough", () => {
    it("maps a 1:1 math.* member to Math.*", () => {
        expect(run("x = math.abs(close)\nplot(x)").statements[0]).toBe(
            "let x = Math.abs(bar.close);",
        );
    });

    it("keeps math.sign on bare Math.sign (no-rewrap decision)", () => {
        expect(run("x = math.sign(close)\nplot(x)").statements[0]).toBe(
            "let x = Math.sign(bar.close);",
        );
    });

    it("maps every passthrough MATH_PASSTHROUGH_MAP entry to its chartlang member", () => {
        for (const [pine, mapping] of MATH_PASSTHROUGH_MAP) {
            // `round_to_mintick` injects a second arg; `avg`/`sum` are scalar
            // with one arg here — both are exercised by dedicated tests below.
            if (mapping.chartlang === null || pine === "math.round_to_mintick") {
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

    it("warns math-not-mapped for an unknown math.* member", () => {
        const { codes } = run("x = math.notathing(close)\nplot(close)");
        expect(codes).toContain("pine-converter/transform/math-not-mapped");
    });

    describe("math.round_to_mintick", () => {
        it("injects syminfo.mintick as the explicit step argument", () => {
            const { statements } = run("x = math.round_to_mintick(close)\nplot(x)");
            expect(statements[0]).toBe("let x = math.roundToMintick(bar.close, syminfo.mintick);");
        });

        it("imports `math` and destructures `syminfo` in the emitted source", () => {
            const { source } = build("x = math.round_to_mintick(close)\nplot(x)");
            expect(source).toContain("import { defineIndicator, plot, math }");
            expect(source).toContain("compute({ bar, plot, syminfo })");
            // `math` is a top-level import only — never destructured;
            // `syminfo` is a destructure only — never imported.
            expect(source).not.toContain("compute({ bar, plot, syminfo, math");
            expect(source).not.toMatch(/import \{[^}]*syminfo/);
        });
    });

    describe("math.avg / math.sum arity", () => {
        it("maps the variadic scalar math.avg to the chartlang math.avg", () => {
            const { statements, codes } = run("x = math.avg(close, open, high)\nplot(x)");
            expect(statements[0]).toBe("let x = math.avg(bar.close, bar.open, bar.high);");
            expect(codes).not.toContain("pine-converter/transform/math-rolling-window-unmapped");
        });

        it("maps a single-arg math.sum to the scalar math.sum", () => {
            const { statements } = run("x = math.sum(close)\nplot(x)");
            expect(statements[0]).toBe("let x = math.sum(bar.close);");
        });

        it("does NOT collapse rolling math.sum(source, length) to the scalar form", () => {
            const { statements, codes } = run("x = math.sum(close, 14)\nplot(x)");
            // The fallback preserves the original call shape (like the
            // `math-not-mapped` path) and flags it with the TODO marker — it
            // never rewrites the 2-arg rolling form into the scalar
            // `math.sum(...)` namespace member.
            expect(statements[0]).toBe(
                "let x = math.sum(bar.close, 14) /* TODO rolling window */;",
            );
            expect(codes).toContain("pine-converter/transform/math-rolling-window-unmapped");
        });

        it("flags rolling math.avg(source, length) the same way", () => {
            const { statements, codes } = run("x = math.avg(close, 20)\nplot(x)");
            expect(statements[0]).toContain("/* TODO rolling window */");
            expect(codes).toContain("pine-converter/transform/math-rolling-window-unmapped");
        });
    });

    describe("nz scalar routing", () => {
        it("lowers nz(x) to the scalar math.nz(x) with the advisory info", () => {
            const { statements, codes } = run("x = nz(close)\nplot(x)");
            expect(statements[0]).toBe("let x = math.nz(bar.close);");
            expect(codes).toContain("pine-converter/transform/nz-scalar-assumed");
        });

        it("lowers nz(x, r) to math.nz(x, r)", () => {
            const { statements } = run("x = nz(close, 0)\nplot(x)");
            expect(statements[0]).toBe("let x = math.nz(bar.close, 0);");
        });

        it("lowers a NESTED nz inside a plot arg (no advisory at the nested site)", () => {
            const { statements, source } = build("plot(nz(close))");
            expect(statements[0]).toBe("plot(math.nz(bar.close));");
            // `math` rides the import even from a nested-only occurrence.
            expect(source).toContain("import { defineIndicator, plot, math }");
        });
    });
});
