// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { Declaration } from "../ast/script.js";
import { lex } from "../lexer/index.js";
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

function run(body: string): {
    statements: readonly string[];
    diagnostics: DiagnosticCollector;
} {
    const src = `//@version=6\nindicator("X")\n${body}\n`;
    const analysis = analyze(parseStatements(lex(src).tokens).script);
    const decl = analysis.script.declaration as ConvertibleDecl;
    const diagnostics = new DiagnosticCollector();
    const scaffold = transformDeclaration(decl, analysis, diagnostics);
    transformInputs(analysis, scaffold, diagnostics);
    transformOther(analysis, scaffold, diagnostics);
    return { statements: scaffold.computeBody.statements, diagnostics };
}

// Each generated call-site is either lowered to a chartlang statement OR has a
// diagnostic recorded — `transformOther` never silently drops a call.
const TA_MEMBERS = ["ta.ema", "ta.sma", "ta.rsi", "ta.kcw"] as const;
const MATH_MEMBERS = ["math.abs", "math.sqrt", "math.random"] as const;
const STR_MEMBERS = ["str.length", "str.upper", "str.replace_all"] as const;

describe("transformOther property", () => {
    it("never lets a ta./math./str. call vanish without a statement or diagnostic", () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...TA_MEMBERS, ...MATH_MEMBERS, ...STR_MEMBERS),
                (member) => {
                    const { statements, diagnostics } = run(`v = ${member}(close)\nplot(close)`);
                    const lowered = statements.some((s) => s.startsWith("let v ="));
                    return lowered || diagnostics.size > 0;
                },
            ),
            { numRuns: 50 },
        );
    });

    it("is deterministic — same source yields identical statements", () => {
        fc.assert(
            fc.property(
                fc.constantFrom(
                    "plot(close)",
                    "if close > open\n    plot(close)",
                    "var n = 0\nn := n + 1\nplot(n)",
                ),
                (body) => {
                    expect(run(body).statements).toEqual(run(body).statements);
                },
            ),
            { numRuns: 20 },
        );
    });
});
