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
    analysis: ReturnType<typeof analyze>;
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
    return { inputs: scaffold.inputs, diagnostics, analysis };
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

    it("folds compile-time color expressions in input.color defaults", () => {
        expect(single("c = input.color(color.rgb(13, 218, 116))").code).toBe(
            'input.color("#0DDA74")',
        );
        expect(single("c = input.color(color.rgb(13, 218, 116, 40))").code).toBe(
            'input.color("#0DDA7499")',
        );
        expect(single("c = input.color(color.new(color.red, 40))").code).toBe(
            'input.color("#FF525299")',
        );
        expect(single("c = input.color(color.yellow)").code).toBe('input.color("#FFEB3B")');
    });

    it("rejects an input.color default with a dynamic color argument", () => {
        const { inputs, diagnostics } = runInputs(
            "someVar = close\nc = input.color(color.rgb(someVar, 0, 0))",
        );
        expect(inputs).toHaveLength(0);
        expect(diagnostics.has("pine-converter/transform/non-literal-input-default")).toBe(true);
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

    it("maps an empty input.timeframe default to the chart-timeframe interval", () => {
        const { inputs, diagnostics } = runInputs('tf = input.timeframe("", title="Timeframe")');
        expect((inputs[0] as InputDeclarationIR).code).toBe(
            'input.interval("", { title: "Timeframe" })',
        );
        expect(diagnostics.has("pine-converter/transform/non-literal-input-default")).toBe(false);
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

describe("transformInputs — input metadata passthrough", () => {
    it("maps title, group, inline, tooltip, display, and confirm", () => {
        const input = single(
            [
                'len = input.int(9, title="Length", group="MA", inline="row",',
                '    tooltip="fast length", display=display.status_line, confirm=true)',
            ].join("\n"),
        );
        expect(input.code).toBe(
            'input.int(9, { title: "Length", group: "MA", inline: "row", tooltip: "fast length", display: "status-line", confirm: true })',
        );
    });

    it("maps input display.data_window and display.none", () => {
        const { inputs } = runInputs(
            [
                "dw = input.bool(true, display=display.data_window)",
                'hidden = input.string("x", display=display.none)',
            ].join("\n"),
        );
        expect(inputs.map((i) => i.code)).toEqual([
            'input.bool(true, { display: "data-window" })',
            'input.string("x", { display: "none" })',
        ]);
    });

    it("omits input display.all because it is the default", () => {
        const { inputs, diagnostics } = runInputs("flag = input.bool(true, display=display.all)");
        expect((inputs[0] as InputDeclarationIR).code).toBe("input.bool(true)");
        expect(diagnostics.has("pine-converter/transform/input-arg-not-mapped")).toBe(false);
    });

    it("maps confirm false as written", () => {
        expect(single("flag = input.bool(true, confirm=false)").code).toBe(
            "input.bool(true, { confirm: false })",
        );
    });

    it("drops non-literal metadata values with the non-literal message", () => {
        const { inputs, diagnostics } = runInputs(
            [
                "len = input.int(9, group=groupName, inline=inlineName, tooltip=hint, confirm=needsConfirm)",
                "flag = input.bool(true, display=showDisplay)",
            ].join("\n"),
        );
        expect(inputs.map((i) => i.code)).toEqual(["input.int(9)", "input.bool(true)"]);
        const messages = diagnostics
            .toArray()
            .filter((d) => d.code === "pine-converter/transform/input-arg-not-mapped")
            .map((d) => d.message);
        expect(messages).toEqual([
            "The `group` input argument was dropped; its value is not a compile-time literal.",
            "The `inline` input argument was dropped; its value is not a compile-time literal.",
            "The `tooltip` input argument was dropped; its value is not a compile-time literal.",
            "The `confirm` input argument was dropped; its value is not a compile-time literal.",
            "The `display` input argument has no chartlang analogue and was dropped.",
        ]);
    });

    it("drops unsupported display members with one display diagnostic", () => {
        const { inputs, diagnostics } = runInputs(
            [
                "a = input.int(1, display=display.price_scale)",
                "b = input.int(2, display=display.pane)",
            ].join("\n"),
        );
        expect(inputs.map((i) => i.code)).toEqual(["input.int(1)", "input.int(2)"]);
        expect(
            diagnostics
                .toArray()
                .filter((d) => d.code === "pine-converter/transform/input-arg-not-mapped"),
        ).toHaveLength(1);
    });
});

describe("transformInputs — input.string(options=) → input.enum", () => {
    it("maps string options with a positional title to input.enum", () => {
        const input = single('t = input.string("EMA", "MA Type", options = ["SMA", "EMA"])');
        expect(input.name).toBe("t");
        expect(input.code).toBe('input.enum("EMA", ["SMA", "EMA"], { title: "MA Type" })');
    });

    it("maps string options with a named title to input.enum", () => {
        expect(single('t = input.string("EMA", options = ["SMA", "EMA"], title = "MA")').code).toBe(
            'input.enum("EMA", ["SMA", "EMA"], { title: "MA" })',
        );
    });

    it("emits no title object when no title is given", () => {
        expect(single('t = input.string("a", options = ["a", "b"])').code).toBe(
            'input.enum("a", ["a", "b"])',
        );
    });

    it("warns when the default is not one of the options but still emits the enum", () => {
        const { inputs, diagnostics } = runInputs('t = input.string("c", options = ["a", "b"])');
        expect((inputs[0] as InputDeclarationIR).code).toBe('input.enum("c", ["a", "b"])');
        expect(
            diagnostics.has("pine-converter/transform/input-string-options-default-mismatch"),
        ).toBe(true);
    });

    it("warns and keeps a plain input.string when an option is non-literal", () => {
        const { inputs, diagnostics } = runInputs('t = input.string("a", options = ["a", other])');
        expect((inputs[0] as InputDeclarationIR).code).toBe('input.string("a")');
        expect(diagnostics.has("pine-converter/transform/input-string-options-not-literal")).toBe(
            true,
        );
        // The non-literal options arg is NOT double-warned as a dropped arg.
        expect(diagnostics.has("pine-converter/transform/input-arg-not-mapped")).toBe(false);
    });

    it("falls back to input.string for a mixed string/numeric options list", () => {
        const { inputs, diagnostics } = runInputs('t = input.string("a", options = ["a", 2])');
        expect((inputs[0] as InputDeclarationIR).code).toBe('input.string("a")');
        expect(diagnostics.has("pine-converter/transform/input-string-options-not-literal")).toBe(
            true,
        );
    });

    it("defers a numeric options list to the plain string path (Task 4)", () => {
        const { inputs, diagnostics } = runInputs('t = input.string("a", options = [1, 2])');
        expect((inputs[0] as InputDeclarationIR).code).toBe('input.string("a")');
        expect(diagnostics.has("pine-converter/transform/input-string-options-not-literal")).toBe(
            false,
        );
        // Numeric options are dropped via the generic unmapped-arg path for now.
        expect(diagnostics.has("pine-converter/transform/input-arg-not-mapped")).toBe(true);
    });

    it("defers an empty options list to the plain string path", () => {
        const { inputs } = runInputs('t = input.string("a", options = [])');
        expect((inputs[0] as InputDeclarationIR).code).toBe('input.string("a")');
    });

    it("drops a non-literal positional title but still emits the enum", () => {
        const { inputs, diagnostics } = runInputs(
            't = input.string("a", close, options = ["a", "b"])',
        );
        expect((inputs[0] as InputDeclarationIR).code).toBe('input.enum("a", ["a", "b"])');
        expect(diagnostics.has("pine-converter/transform/input-arg-not-mapped")).toBe(true);
    });

    it("maps metadata alongside the enum", () => {
        const { inputs, diagnostics } = runInputs(
            [
                't = input.string("a", "Mode", options = ["a", "b"],',
                '    group = "G", inline = "row", tooltip = "hint", display = display.data_window, confirm = true)',
            ].join("\n"),
        );
        expect((inputs[0] as InputDeclarationIR).code).toBe(
            'input.enum("a", ["a", "b"], { title: "Mode", group: "G", inline: "row", tooltip: "hint", display: "data-window", confirm: true })',
        );
        expect(diagnostics.has("pine-converter/transform/input-arg-not-mapped")).toBe(false);
    });

    it("warns on an extra unmapped named arg alongside the enum", () => {
        const { inputs, diagnostics } = runInputs(
            't = input.string("a", options = ["a", "b"], active = true)',
        );
        expect((inputs[0] as InputDeclarationIR).code).toBe('input.enum("a", ["a", "b"])');
        expect(diagnostics.has("pine-converter/transform/input-arg-not-mapped")).toBe(true);
    });

    it("still warns on range args that have no synthesized-enum analogue", () => {
        const { inputs, diagnostics } = runInputs(
            "len = input.int(8, options = [8, 21], minval = 1)",
        );
        expect((inputs[0] as InputDeclarationIR).code).toBe("input.enum(8, [8, 21])");
        expect(diagnostics.has("pine-converter/transform/input-arg-not-mapped")).toBe(true);
    });

    it("defers when string options are present but no default is given", () => {
        const { inputs } = runInputs('t = input.string(options = ["a", "b"])');
        expect(inputs).toHaveLength(0);
    });

    it("rejects a non-literal default before reaching the enum branch", () => {
        const { inputs, diagnostics } = runInputs('t = input.string(sym, options = ["a", "b"])');
        expect(inputs).toHaveLength(0);
        expect(diagnostics.has("pine-converter/transform/non-literal-input-default")).toBe(true);
    });
});

describe("transformInputs — native input.enum", () => {
    it("lowers a native enum input to a string-backed chartlang enum with metadata", () => {
        const input = single(
            [
                'enum Signal\n    buy = "Buy Signal"\n    sell = "Sell Signal"\n    flat',
                'sig = input.enum(Signal.sell, "Entry Signal", group="Trade", tooltip="Pick")',
            ].join("\n"),
        );
        expect(input.name).toBe("sig");
        expect(input.code).toBe(
            'input.enum("Sell Signal", ["Buy Signal", "Sell Signal", "flat"], { title: "Entry Signal", group: "Trade", tooltip: "Pick" })',
        );
    });

    it("rejects native enum defaults that are not enum member references", () => {
        const { inputs, diagnostics } = runInputs(
            'enum Signal\n    buy\nsig = input.enum("buy", "Signal")',
        );
        expect(inputs).toHaveLength(0);
        expect(diagnostics.has("pine-converter/transform/input-enum-default-not-member")).toBe(
            true,
        );
    });

    it("flags an unknown member default at both the semantic and transform layers", () => {
        // `Signal.nope` IS a member-access expression (so it passes the first
        // guard) but `nope` is not a declared member — the second guard rejects
        // it. The two layers report independently: the semantic walk flags the
        // bad member reference (`unknown-enum-member`), the transform drops the
        // input (`input-enum-default-not-member`). Both are honest, distinct
        // notes — this test pins that layered behavior.
        const { inputs, diagnostics, analysis } = runInputs(
            "enum Signal\n    buy\nsig = input.enum(Signal.nope)",
        );
        expect(inputs).toHaveLength(0);
        expect(diagnostics.has("pine-converter/transform/input-enum-default-not-member")).toBe(
            true,
        );
        expect(analysis.diagnostics.map((diag) => diag.code)).toContain(
            "pine-converter/semantic/unknown-enum-member",
        );
    });
});

describe("transformInputs — numeric input.int/float(options=) → input.enum<number>", () => {
    it("maps an integer dropdown with a positional title to a numeric enum", () => {
        const input = single(
            'ma_length = input.int(21, "MA Length", options = [8, 21, 30, 50, 100, 200])',
        );
        expect(input.name).toBe("ma_length");
        expect(input.code).toBe(
            'input.enum(21, [8, 21, 30, 50, 100, 200], { title: "MA Length" })',
        );
    });

    it("maps a float dropdown with no title to a numeric enum", () => {
        expect(single("mult = input.float(2.0, options = [1.0, 2.0, 3.0])").code).toBe(
            "input.enum(2.0, [1.0, 2.0, 3.0])",
        );
    });

    it("warns when the numeric default is not one of the options but still emits the enum", () => {
        const { inputs, diagnostics } = runInputs("len = input.int(99, options = [8, 21])");
        expect((inputs[0] as InputDeclarationIR).code).toBe("input.enum(99, [8, 21])");
        expect(
            diagnostics.has("pine-converter/transform/input-string-options-default-mismatch"),
        ).toBe(true);
    });

    it("does not warn when an int default matches a float option of equal value", () => {
        const { inputs, diagnostics } = runInputs("len = input.float(2, options = [2.0, 4.0])");
        expect((inputs[0] as InputDeclarationIR).code).toBe("input.enum(2, [2.0, 4.0])");
        expect(
            diagnostics.has("pine-converter/transform/input-string-options-default-mismatch"),
        ).toBe(false);
    });

    it("falls back to a plain input.int for a mixed numeric/non-literal options list", () => {
        const { inputs, diagnostics } = runInputs("len = input.int(8, options = [8, other])");
        expect((inputs[0] as InputDeclarationIR).code).toBe("input.int(8)");
        expect(diagnostics.has("pine-converter/transform/input-string-options-not-literal")).toBe(
            true,
        );
        expect(diagnostics.has("pine-converter/transform/input-arg-not-mapped")).toBe(false);
    });

    it("defers an all-string options list on input.int to the plain int path", () => {
        const { inputs, diagnostics } = runInputs('len = input.int(8, options = ["a", "b"])');
        expect((inputs[0] as InputDeclarationIR).code).toBe("input.int(8)");
        expect(diagnostics.has("pine-converter/transform/input-string-options-not-literal")).toBe(
            false,
        );
        expect(diagnostics.has("pine-converter/transform/input-arg-not-mapped")).toBe(true);
    });

    it("defers an empty numeric options list to the plain int path", () => {
        const { inputs } = runInputs("len = input.int(8, options = [])");
        expect((inputs[0] as InputDeclarationIR).code).toBe("input.int(8)");
    });
});

describe("transformInputs — unmapped-arg consolidation", () => {
    const unmappedCount = (diagnostics: DiagnosticCollector): number =>
        diagnostics
            .toArray()
            .filter((d) => d.code === "pine-converter/transform/input-arg-not-mapped").length;

    it("passes through metadata without unmapped diagnostics", () => {
        const { inputs, diagnostics } = runInputs(
            [
                'fast = input.int(9, group="MA", inline="row", tooltip="fast")',
                'slow = input.int(21, group="MA", inline="row", tooltip="slow")',
                'src = input.source(close, group="MA", inline="row", tooltip="src")',
            ].join("\n"),
        );
        expect(inputs).toHaveLength(3);
        expect(inputs.map((i) => i.code)).toEqual([
            'input.int(9, { group: "MA", inline: "row", tooltip: "fast" })',
            'input.int(21, { group: "MA", inline: "row", tooltip: "slow" })',
            'input.source("close", { group: "MA", inline: "row", tooltip: "src" })',
        ]);
        expect(unmappedCount(diagnostics)).toBe(0);
    });

    it("consolidates one arg name across different input primitives", () => {
        const { diagnostics } = runInputs(
            ["a = input.int(1, active=true)", "b = input.bool(true, active=false)"].join("\n"),
        );
        expect(unmappedCount(diagnostics)).toBe(1);
    });

    it("keeps the first occurrence span as the representative", () => {
        const { diagnostics } = runInputs(
            ["a = input.int(1, active=true)", "b = input.int(2, active=false)"].join("\n"),
        );
        const diag = diagnostics
            .toArray()
            .find((d) => d.code === "pine-converter/transform/input-arg-not-mapped");
        // Line 3 is the first input (line 1 is the version directive, 2 the indicator).
        expect(diag?.span.startLine).toBe(3);
    });

    it("reports a non-literal modelled arg with a distinct value message", () => {
        const { diagnostics } = runInputs("len = input.int(9, title=someName)");
        const diag = diagnostics
            .toArray()
            .find((d) => d.code === "pine-converter/transform/input-arg-not-mapped");
        expect(diag?.message).toBe(
            "The `title` input argument was dropped; its value is not a compile-time literal.",
        );
    });
});

describe("transformInputs — bare input() → source / typed", () => {
    it("maps a named series default to a hoisted input.source", () => {
        const input = single('lt_trend = input(title = "LT", defval = close)');
        expect(input.name).toBe("lt_trend");
        expect(input.code).toBe('input.source("close", { title: "LT" })');
    });

    it("maps a positional series default to input.source", () => {
        expect(single("s = input(close)").code).toBe('input.source("close")');
    });

    it("maps a positional integer default to a typed input.int (dropping a positional title)", () => {
        expect(single('n = input(14, "Smoothing")').code).toBe("input.int(14)");
    });

    it("threads a named title onto a typed default", () => {
        expect(single('n = input(14, title = "N")').code).toBe('input.int(14, { title: "N" })');
    });

    it("maps a float default to input.float", () => {
        expect(single("f = input(2.5)").code).toBe("input.float(2.5)");
    });

    it("maps a bool default to input.bool", () => {
        expect(single("b = input(true)").code).toBe("input.bool(true)");
    });

    it("maps a string default to input.string", () => {
        expect(single('s = input("AAPL")').code).toBe('input.string("AAPL")');
    });

    it("maps a color default to input.color", () => {
        expect(single("c = input(#ff0000)").code).toBe('input.color("#ff0000")');
    });

    it("maps a unary-negated numeric default to a typed input.int", () => {
        expect(single("n = input(-5)").code).toBe("input.int(-5)");
    });

    it("rejects a bare input with no default", () => {
        const { inputs, diagnostics } = runInputs('x = input(title = "X")');
        expect(inputs).toHaveLength(0);
        expect(diagnostics.has("pine-converter/transform/non-literal-input-default")).toBe(true);
    });

    it("rejects a bare input whose default is na", () => {
        const { inputs, diagnostics } = runInputs("x = input(defval = na)");
        expect(inputs).toHaveLength(0);
        expect(diagnostics.has("pine-converter/transform/non-literal-input-default")).toBe(true);
    });

    it("rejects a bare input whose default is a unary not", () => {
        const { inputs, diagnostics } = runInputs("x = input(not true)");
        expect(inputs).toHaveLength(0);
        expect(diagnostics.has("pine-converter/transform/non-literal-input-default")).toBe(true);
    });

    it("rejects a bare input whose default is a computed expression", () => {
        const { inputs, diagnostics } = runInputs("x = input(close + 1)");
        expect(inputs).toHaveLength(0);
        expect(diagnostics.has("pine-converter/transform/non-literal-input-default")).toBe(true);
    });
});
