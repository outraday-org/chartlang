// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

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

function runInputs(body: string): {
    inputs: readonly InputDeclarationIR[];
    codes: readonly string[];
} {
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
    return { inputs: scaffold.inputs, codes: diagnostics.toArray().map((d) => d.code) };
}

describe("transformInputs — rejects", () => {
    it("rejects input.enum when the default is not an enum member", () => {
        const { inputs, codes } = runInputs('mode = input.enum("up")');
        expect(inputs).toHaveLength(0);
        expect(codes).toContain("pine-converter/transform/input-enum-default-not-member");
    });

    it("rejects a non-built-in input.source default", () => {
        const { inputs, codes } = runInputs("src = input.source(myVar)");
        expect(inputs).toHaveLength(0);
        expect(codes).toContain("pine-converter/transform/non-literal-source-input");
    });

    it("rejects a non-literal input default", () => {
        const { inputs, codes } = runInputs("len = input.int(syminfo.mintick)");
        expect(inputs).toHaveLength(0);
        expect(codes).toContain("pine-converter/transform/non-literal-input-default");
    });

    it("rejects a non-string-literal timeframe default", () => {
        const { inputs, codes } = runInputs("tf = input.timeframe(someTf)");
        expect(inputs).toHaveLength(0);
        expect(codes).toContain("pine-converter/transform/non-literal-input-default");
    });

    it("rejects an unknown timeframe string", () => {
        const { inputs, codes } = runInputs('tf = input.timeframe("999")');
        expect(inputs).toHaveLength(0);
        expect(codes).toContain("pine-converter/transform/non-literal-input-default");
    });

    it("warns once on an unmapped named argument and still emits the input", () => {
        const { inputs, codes } = runInputs("len = input.int(9, active=true)");
        expect(inputs).toHaveLength(1);
        expect(
            codes.filter((c) => c === "pine-converter/transform/input-arg-not-mapped"),
        ).toHaveLength(1);
        expect(inputs[0]?.code).toBe("input.int(9)");
    });

    it("warns when a title argument is not a string literal", () => {
        const { inputs, codes } = runInputs("len = input.int(9, title=someName)");
        expect(inputs).toHaveLength(1);
        expect(codes).toContain("pine-converter/transform/input-arg-not-mapped");
        expect(inputs[0]?.code).toBe("input.int(9)");
    });

    it("warns when a range argument is not a literal", () => {
        const { inputs, codes } = runInputs("len = input.int(9, minval=syminfo.mintick)");
        expect(inputs).toHaveLength(1);
        expect(codes).toContain("pine-converter/transform/input-arg-not-mapped");
        expect(inputs[0]?.code).toBe("input.int(9)");
    });

    it("skips an input with no default argument", () => {
        const { inputs } = runInputs("len = input.int()");
        expect(inputs).toHaveLength(0);
    });

    it("rejects a unary applied to a non-numeric literal default", () => {
        const { inputs, codes } = runInputs('s = input.string(-"x")');
        expect(inputs).toHaveLength(0);
        expect(codes).toContain("pine-converter/transform/non-literal-input-default");
    });

    it("warns and drops an unrecognised input.* primitive", () => {
        const { inputs, codes } = runInputs("v = input.unknownkind(5)");
        expect(inputs).toHaveLength(0);
        expect(codes).toContain("pine-converter/transform/unknown-input-primitive");
    });
});
