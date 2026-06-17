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
import type { InputDeclarationIR } from "./ir.js";

type ConvertibleDecl = Extract<
    Declaration,
    { kind: "indicator-declaration" | "strategy-declaration" }
>;

function inputsOf(body: string): readonly InputDeclarationIR[] {
    const src = `//@version=6\nindicator("X")\n${body}\nplot(close)\n`;
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
    transformInputs(analysis, scaffold, diagnostics);
    return scaffold.inputs;
}

describe("transformInputs — property", () => {
    it("emits exactly one InputDeclarationIR per named int input", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 8 }),
                fc.array(fc.integer(), { minLength: 1, maxLength: 8 }),
                (count, defaults) => {
                    const names = Array.from({ length: count }, (_, i) => `inp${i}`);
                    const body = names
                        .map((name, i) => `${name} = input.int(${defaults[i % defaults.length]})`)
                        .join("\n");
                    const inputs = inputsOf(body);
                    expect(inputs).toHaveLength(count);
                    expect(inputs.map((input) => input.name)).toEqual(names);
                },
            ),
        );
    });

    it("every emitted input code is a parseable chartlang input.* call", () => {
        fc.assert(
            fc.property(fc.integer({ min: -1000, max: 1000 }), (value) => {
                const inputs = inputsOf(`v = input.int(${value})`);
                expect(inputs).toHaveLength(1);
                expect(inputs[0]?.code).toMatch(/^input\.int\(-?\d+\)$/);
            }),
        );
    });
});
