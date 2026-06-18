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
    it("maps a clean ta.* member through with arg passthrough + `.current`", () => {
        // `ta.*` returns a `Series<number>`; `.current` projects the scalar so
        // the value is usable as a number in Pine's per-bar model.
        expect(run("x = ta.ema(close, 9)\nplot(x)").statements[0]).toBe(
            "let x = ta.ema(bar.close, 9).current;",
        );
    });

    it("maps every non-null TA_PASSTHROUGH_MAP entry to its chartlang member", () => {
        for (const [pine, mapping] of TA_PASSTHROUGH_MAP) {
            if (mapping.chartlang === null) {
                continue;
            }
            // `pivothigh`/`pivotlow` restructure into a `pivotsHighLow({...})`
            // field projection rather than a plain rename — covered separately.
            if (pine === "ta.pivothigh" || pine === "ta.pivotlow") {
                continue;
            }
            const { statements } = run(`x = ${pine}(close, 9)\nplot(x)`);
            expect(statements[0]).toBe(`let x = ${mapping.chartlang}(bar.close, 9).current;`);
        }
    });

    it("restructures ta.pivothigh / ta.pivotlow into a pivotsHighLow field projection", () => {
        expect(run("x = ta.pivothigh(5, 3)\nplot(x)").statements[0]).toBe(
            "let x = ta.pivotsHighLow({ leftLength: 5, rightLength: 3 }).high.current;",
        );
        expect(run("y = ta.pivotlow(5, 3)\nplot(y)").statements[0]).toBe(
            "let y = ta.pivotsHighLow({ leftLength: 5, rightLength: 3 }).low.current;",
        );
        // A single-arg form reuses the bound for both lengths.
        expect(run("z = ta.pivothigh(4)\nplot(z)").statements[0]).toBe(
            "let z = ta.pivotsHighLow({ leftLength: 4, rightLength: 4 }).high.current;",
        );
        // Defensive: no args → an empty-opts pivot call (still type-valid).
        expect(run("w = ta.pivothigh()\nplot(w)").statements[0]).toBe(
            "let w = ta.pivotsHighLow().high.current;",
        );
    });

    it("warns ta-signature-divergence for an entry with a signatureNote", () => {
        const { statements, codes } = run("x = ta.rma(close, 9)\nplot(x)");
        expect(statements[0]).toBe("let x = ta.smma(bar.close, 9).current;");
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
