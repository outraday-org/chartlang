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
    diagnostics: DiagnosticCollector;
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
    return { inputs: scaffold.inputs, diagnostics };
}

function single(body: string): InputDeclarationIR {
    const { inputs } = runInputs(body);
    expect(inputs).toHaveLength(1);
    return inputs[0] as InputDeclarationIR;
}

describe("transformInputs — per-kind mapping", () => {
    it("maps the acceptance int fixture with title + range options", () => {
        const input = single('len = input.int(20, title="Length", minval=1, maxval=200, step=1)');
        expect(input.name).toBe("len");
        expect(input.code).toBe('input.int(20, { title: "Length", min: 1, max: 200, step: 1 })');
    });

    it("maps input.float", () => {
        expect(single("mult = input.float(1.5)").code).toBe("input.float(1.5)");
    });

    it("maps input.bool", () => {
        expect(single("flag = input.bool(true)").code).toBe("input.bool(true)");
    });

    it("maps input.string", () => {
        expect(single('mode = input.string("fast")').code).toBe('input.string("fast")');
    });

    it("maps input.color to a quoted literal", () => {
        expect(single("col = input.color(#ff0000)").code).toBe('input.color("#ff0000")');
    });

    it("maps input.session straight through (string spec)", () => {
        expect(single('sess = input.session("0930-1600")').code).toBe('input.session("0930-1600")');
    });

    it("maps input.source close to a SourceField literal", () => {
        expect(single('src = input.source(close, title="Source")').code).toBe(
            'input.source("close", { title: "Source" })',
        );
    });

    it("maps every OHLCV / synthetic source built-in", () => {
        const fields = ["open", "high", "low", "close", "volume", "hl2", "hlc3", "ohlc4", "hlcc4"];
        for (const field of fields) {
            expect(single(`s = input.source(${field})`).code).toBe(`input.source("${field}")`);
        }
    });

    it("maps input.symbol", () => {
        expect(single('sym = input.symbol("AAPL")').code).toBe('input.symbol("AAPL")');
    });

    it("maps input.timeframe to input.interval with a converted string", () => {
        const input = single('tf = input.timeframe("60", title="Higher TF")');
        expect(input.code).toBe('input.interval("1h", { title: "Higher TF" })');
    });

    it("maps input.time", () => {
        expect(single("t = input.time(0)").code).toBe("input.time(0)");
    });

    it("maps input.price", () => {
        expect(single("p = input.price(100.0)").code).toBe("input.price(100.0)");
    });

    it("maps input.text_area to input.string with multiline:true", () => {
        const input = single('note = input.text_area("hi", title="Note")');
        expect(input.code).toBe('input.string("hi", { title: "Note", multiline: true })');
    });

    it("maps input.text_area with no other options to a bare multiline object", () => {
        expect(single('note = input.text_area("hi")').code).toBe(
            'input.string("hi", { multiline: true })',
        );
    });

    it("emits no options object when only a default is present", () => {
        expect(single("len = input.int(9)").code).toBe("input.int(9)");
    });

    it("declares one input per declaration and leaves the body order intact", () => {
        const { inputs } = runInputs("a = input.int(1)\nb = input.float(2.0)");
        expect(inputs.map((i) => i.name)).toEqual(["a", "b"]);
    });

    it("supports a typed var declaration of an input", () => {
        const input = single("int len = input.int(14)");
        expect(input.name).toBe("len");
        expect(input.code).toBe("input.int(14)");
    });

    it("accepts a negated integer default", () => {
        expect(single("len = input.int(-1)").code).toBe("input.int(-1)");
    });

    it("accepts a negated float default", () => {
        expect(single("d = input.float(-1.5)").code).toBe("input.float(-1.5)");
    });

    it("accepts a unary-plus numeric default", () => {
        expect(single("len = input.int(+3)").code).toBe("input.int(+3)");
    });
});
