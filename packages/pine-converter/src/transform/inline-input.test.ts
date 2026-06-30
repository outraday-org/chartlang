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

describe("transformInputs — inline promotion", () => {
    it("promotes an inline input inside a call argument", () => {
        const { inputs, codes } = runInputs("v = ta.ema(close, input.int(20))");
        expect(inputs).toHaveLength(1);
        expect(inputs[0]).toEqual({ name: "inlineInput", code: "input.int(20)" });
        expect(codes).toContain("pine-converter/transform/inline-input-promoted");
    });

    it("promotes multiple inline inputs with sequential synthesised names", () => {
        const { inputs } = runInputs("v = ta.ema(input.source(close), input.int(20))");
        expect(inputs.map((i) => i.name)).toEqual(["inlineInput", "inlineInput2"]);
    });

    it("promotes an inline input inside a binary / ternary / paren expression", () => {
        const { inputs } = runInputs("v = (input.int(1) + input.int(2)) > 0 ? input.int(3) : 0");
        expect(inputs.map((i) => i.code)).toEqual(["input.int(1)", "input.int(2)", "input.int(3)"]);
    });

    it("promotes an inline input inside an if condition and body", () => {
        const { inputs } = runInputs("if input.bool(true)\n    x = ta.sma(close, input.int(5))\n");
        expect(inputs.map((i) => i.code)).toEqual(["input.bool(true)", "input.int(5)"]);
    });

    it("promotes an inline input inside a for header and body", () => {
        const { inputs } = runInputs(
            "for i = 0 to input.int(3)\n    y = ta.sma(close, input.int(5))\n",
        );
        expect(inputs.map((i) => i.code)).toEqual(["input.int(3)", "input.int(5)"]);
    });

    it("promotes an inline input inside a history access", () => {
        const { inputs } = runInputs("v = close[input.int(1)]");
        expect(inputs.map((i) => i.code)).toEqual(["input.int(1)"]);
    });

    it("promotes an inline input inside a unary operand", () => {
        const { inputs } = runInputs("v = -input.float(1.0)");
        expect(inputs.map((i) => i.code)).toEqual(["input.float(1.0)"]);
    });

    it("does not double-count a named input as inline", () => {
        const { inputs } = runInputs("len = input.int(20)");
        expect(inputs.map((i) => i.name)).toEqual(["len"]);
    });

    it("promotes inline inputs across else-if and else bodies", () => {
        const { inputs } = runInputs(
            "if a\n    x = ta.sma(close, input.int(1))\nelse if b\n    y = ta.sma(close, input.int(2))\nelse\n    z = ta.sma(close, input.int(3))\n",
        );
        expect(inputs.map((i) => i.code)).toEqual(["input.int(1)", "input.int(2)", "input.int(3)"]);
    });

    it("promotes an inline input inside a for step clause", () => {
        const { inputs } = runInputs("for i = 0 to 5 by input.int(2)\n    x = 1\n");
        expect(inputs.map((i) => i.code)).toEqual(["input.int(2)"]);
    });

    it("promotes an inline input whose result is a member-access receiver", () => {
        const { inputs } = runInputs("v = input.source(close).foo");
        expect(inputs.map((i) => i.code)).toEqual(['input.source("close")']);
    });

    it("promotes an inline input inside a lambda body", () => {
        const { inputs } = runInputs("f = (x) => ta.sma(close, input.int(5))");
        expect(inputs.map((i) => i.code)).toEqual(["input.int(5)"]);
    });

    it("promotes an inline input in a bare expression statement", () => {
        const { inputs } = runInputs("ta.sma(close, input.int(7))");
        expect(inputs.map((i) => i.code)).toEqual(["input.int(7)"]);
    });

    it("skips an unconvertible inline input but keeps converting siblings", () => {
        const { inputs, codes } = runInputs('v = ta.ema(input.enum("up"), input.int(9))');
        expect(inputs.map((i) => i.code)).toEqual(["input.int(9)"]);
        expect(codes).toContain("pine-converter/transform/input-enum-default-not-member");
    });

    it("promotes a native enum input inline", () => {
        const { inputs, codes } = runInputs(
            [
                'enum Signal\n    buy = "Buy Signal"\n    sell = "Sell Signal"',
                "v = input.enum(Signal.buy) == Signal.sell",
            ].join("\n"),
        );
        expect(inputs.map((i) => i.code)).toEqual([
            'input.enum("Buy Signal", ["Buy Signal", "Sell Signal"])',
        ]);
        expect(codes).toContain("pine-converter/transform/inline-input-promoted");
    });
});
