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
import type { ScriptScaffold } from "./ir.js";
import { transformOther } from "./other.js";

type ConvertibleDecl = Extract<
    Declaration,
    { kind: "indicator-declaration" | "strategy-declaration" }
>;

function run(body: string): { scaffold: ScriptScaffold; diagnostics: DiagnosticCollector } {
    const src = `//@version=6\nindicator("X")\n${body}\n`;
    const analysis = analyze(parseStatements(lex(src).tokens).script);
    const decl = analysis.script.declaration;
    if (
        decl === null ||
        decl.kind === "library-declaration" ||
        decl.kind === "import-declaration"
    ) {
        throw new Error("expected an indicator declaration in the fixture");
    }
    const diagnostics = new DiagnosticCollector();
    const scaffold = transformDeclaration(decl as ConvertibleDecl, analysis, diagnostics);
    transformInputs(analysis, scaffold, diagnostics);
    transformOther(analysis, scaffold, diagnostics);
    return { scaffold, diagnostics };
}

function stmts(body: string): readonly string[] {
    return run(body).scaffold.computeBody.statements;
}

function codes(body: string): string[] {
    return run(body)
        .diagnostics.toArray()
        .map((d) => d.code);
}

describe("transformOther — control flow", () => {
    it("lowers if/else if/else with OHLCV remap", () => {
        expect(
            stmts(
                "if close > open\n    plot(close)\nelse if close < open\n    plot(open)\nelse\n    plot(high)",
            ),
        ).toEqual([
            "if (bar.close > bar.open) { plot(bar.close); } else if (bar.close < bar.open) { plot(bar.open); } else { plot(bar.high); }",
        ]);
    });

    it("unrolls a stateful for body into one statement per iteration", () => {
        expect(stmts("for i = 0 to 2\n    plot(close[i])")).toEqual([
            "plot(bar.close[0]);",
            "plot(bar.close[1]);",
            "plot(bar.close[2]);",
        ]);
        expect(codes("for i = 0 to 2\n    plot(close[i])")).toContain(
            "pine-converter/transform/loop-body-unrolled",
        );
    });

    it("emits a runtime for loop for a non-stateful literal-bounded body", () => {
        expect(stmts("sum = 0.0\nfor i = 0 to 2\n    sum := sum + i")).toEqual([
            "let sum = 0.0;",
            "for (let i = 0; i <= 2; i++) { sum = sum + i; }",
        ]);
    });

    it("emits a stepped runtime for loop", () => {
        expect(stmts("sum = 0.0\nfor i = 0 to 4 by 2\n    sum := sum + i")).toEqual([
            "let sum = 0.0;",
            "for (let i = 0; i <= 4; i += 2) { sum = sum + i; }",
        ]);
    });

    it("rejects a stateful body with a non-resolvable bound", () => {
        const src = "n = close\nfor i = 0 to n\n    plot(close[i])";
        expect(stmts(src)).toEqual(["let n = bar.close;"]);
        expect(codes(src)).toContain(
            "pine-converter/transform/loop-bounds-not-literal-for-stateful-body",
        );
    });

    it("rejects a non-stateful body with a non-resolvable bound", () => {
        const src = "n = close\nsum = 0.0\nfor i = 0 to n\n    sum := sum + i";
        expect(codes(src)).toContain(
            "pine-converter/transform/loop-bounds-not-literal-for-stateful-body",
        );
    });

    it("unrolls when the for bound is an input.int default and warns it is frozen", () => {
        const src = "len = input.int(2)\nfor i = 0 to len\n    plot(close[i])";
        expect(stmts(src)).toEqual([
            "plot(bar.close[0]);",
            "plot(bar.close[1]);",
            "plot(bar.close[2]);",
        ]);
        expect(codes(src)).toContain(
            "pine-converter/transform/loop-unroll-frozen-at-input-default",
        );
    });

    it("unrolls a non-stateful input-bounded for (runtime loop would be rejected)", () => {
        const src = "len = input.int(1)\nsum = 0.0\nfor i = 0 to len\n    sum := sum + i";
        expect(stmts(src)).toEqual(["let sum = 0.0;", "sum = sum + 0;", "sum = sum + 1;"]);
        expect(codes(src)).toContain(
            "pine-converter/transform/loop-unroll-frozen-at-input-default",
        );
    });

    it("lowers a subjected switch into a switch block", () => {
        expect(
            stmts("x = 1\nswitch x\n    1 => plot(close)\n    2 => plot(open)\n    => plot(high)"),
        ).toEqual([
            "let x = 1;",
            "switch (x) { case 1: { plot(bar.close); break; } case 2: { plot(bar.open); break; } default: { plot(bar.high); break; } }",
        ]);
    });

    it("lowers a subjectless switch into an if/else chain", () => {
        expect(stmts("switch\n    close > open => plot(close)\n    => plot(open)")).toEqual([
            "if (bar.close > bar.open) { plot(bar.close); } else { plot(bar.open); }",
        ]);
    });

    it("lowers a default-only subjectless switch unconditionally", () => {
        expect(stmts("switch\n    => plot(close)")).toEqual(["{ plot(bar.close); }"]);
    });

    it("chains multiple subjectless switch cases into else-if", () => {
        expect(
            stmts("switch\n    close > open => plot(close)\n    close < open => plot(open)"),
        ).toEqual([
            "if (bar.close > bar.open) { plot(bar.close); } else if (bar.close < bar.open) { plot(bar.open); }",
        ]);
    });

    it("emits break and continue inside an unrolled loop body", () => {
        const src =
            "for i = 0 to 1\n    if close > open\n        plot(close)\n        break\n    continue";
        const out = stmts(src);
        expect(out.join(" ")).toContain("break;");
        expect(out.join(" ")).toContain("continue;");
    });

    it("detects a stateful primitive nested in a for/switch/block inside the loop body", () => {
        const nestedFor = "for i = 0 to 1\n    for j = 0 to 1\n        plot(close[j])";
        expect(stmts(nestedFor).every((s) => s.startsWith("plot("))).toBe(true);
        const nestedSwitch =
            "x = 1\nfor i = 0 to 1\n    switch x\n        1 => plot(close)\n        => break";
        expect(stmts(nestedSwitch).some((s) => s.includes("plot(bar.close)"))).toBe(true);
    });

    it("substitutes the iterator through nested statements when unrolling a stateful loop", () => {
        const src =
            "sum = 0.0\nfor i = 0 to 1\n    x = close[i]\n    if i > 0\n        sum := sum + i\n        plot(close[i])\n    else if i < 0\n        sum := i\n    else\n        sum := 0";
        const out = stmts(src).join(" ");
        // The iterator is substituted into the nested decl, the if condition,
        // and the assignment in each unrolled copy.
        expect(out).toContain("x = bar.close[0];");
        expect(out).toContain("x = bar.close[1];");
        expect(out).toContain("if (0 > 0)");
        expect(out).toContain("if (1 > 0)");
        expect(out).toContain("sum = sum + 1;");
        expect(out).toContain("else if (1 < 0)");
    });
});

describe("transformOther — scalars", () => {
    it("lowers a var int scalar to a state.int slot and reassignment to .value", () => {
        const { scaffold } = run("var n = 0\nn := n + 1\nplot(n)");
        expect(scaffold.stateSlots).toEqual([{ name: "n", initExpr: "state.int(0)" }]);
        expect(scaffold.computeBody.statements).toEqual([
            "n.value = n.value + 1;",
            "plot(n.value);",
        ]);
    });

    it("infers float/bool/string slot factories", () => {
        expect(run("var f = 1.5\nplot(f)").scaffold.stateSlots[0].initExpr).toBe(
            "state.float(1.5)",
        );
        expect(run("var b = true\nplot(close)").scaffold.stateSlots[0].initExpr).toBe(
            "state.bool(true)",
        );
        expect(run('var s = "hi"\nplot(close)').scaffold.stateSlots[0].initExpr).toBe(
            'state.string("hi")',
        );
    });

    it("infers a slot factory from a unary-literal initializer", () => {
        expect(run("var n = -3\nplot(n)").scaffold.stateSlots[0].initExpr).toBe("state.int(-3)");
    });

    it("uses a tick slot for varip and defaults an un-inferable scalar to float", () => {
        const { scaffold, diagnostics } = run("varip k = close\nk := close\nplot(k)");
        expect(scaffold.stateSlots[0].initExpr).toBe("state.tick.float(bar.close)");
        expect(diagnostics.toArray().map((d) => d.code)).toContain(
            "pine-converter/transform/scalar-state-type-defaulted",
        );
    });

    it("emits a plain local for a non-var declaration and reassignment", () => {
        expect(stmts("a = 1\na := a + 1\nplot(a)")).toEqual([
            "let a = 1;",
            "a = a + 1;",
            "plot(a);",
        ]);
    });

    it("emits let for a shadowing `=` declaration", () => {
        const out = stmts("a = close\nif true\n    a = open\nplot(a)");
        expect(out.join(" ")).toContain("let a = bar.open;");
    });
});

describe("transformOther — passthrough and skips", () => {
    it("rewrites input references to inputs.<name>", () => {
        expect(stmts("len = input.int(20)\nplot(ta.sma(close, len))")).toEqual([
            "plot(ta.sma(bar.close, (inputs.len as number)));",
        ]);
    });

    it("does not rewrite a local that shadows an input name", () => {
        const out = stmts("len = input.int(20)\nfor len = 0 to 1\n    plot(close[len])");
        expect(out.join(" ")).toContain("plot(bar.close[0]);");
    });

    it("emits a ternary verbatim", () => {
        expect(stmts("c = close > open ? 1 : 2\nplot(c)")).toEqual([
            "let c = (bar.close > bar.open) ? 1 : 2;",
            "plot(c);",
        ]);
    });

    it("skips a drawing handle declaration, setter, and delete", () => {
        const src =
            "var line lvl = na\nif barstate.islast\n    lvl := line.new(bar_index, close, bar_index, close)\n    line.set_xy1(lvl, bar_index, close)\n    line.delete(lvl)\nplot(close)";
        const out = stmts(src);
        expect(out.join(" ")).not.toContain("line.new");
        expect(out.join(" ")).not.toContain("line.set_xy1");
        expect(out.join(" ")).toContain("plot(bar.close);");
    });

    it("skips a drawing ring push and its eviction guard", () => {
        const out = stmts(
            "var line[] lines = array.new<line>()\narray.push(lines, line.new(bar_index, close, bar_index, close))\nif array.size(lines) > 5\n    line.delete(array.shift(lines))\nplot(close)",
        );
        expect(out.join(" ")).not.toContain("array.push");
        expect(out.join(" ")).not.toContain("array.size");
        expect(out.join(" ")).toContain("plot(bar.close);");
    });

    it("emits a bare non-call expression statement and a return is dropped", () => {
        const out = stmts("x = 1\nx");
        expect(out).toContain("x;");
    });

    it("emits a plain non-drawing call through with a semicolon", () => {
        expect(stmts("y = 0\ny := nz(close, 0)")).toContain("y = nz(bar.close, 0);");
    });

    it("lowers request.security as a declaration value", () => {
        expect(stmts('htf = request.security(syminfo.tickerid, "1D", close)\nplot(htf)')).toContain(
            'let htf = request.security({ interval: "1d" }).close;',
        );
    });

    it("lowers a ta.* / math.* call as a declaration value", () => {
        expect(stmts("e = ta.ema(close, 9)\nplot(e)")).toContain(
            "let e = ta.ema(bar.close, 9).current;",
        );
        expect(stmts("m = math.abs(close)\nplot(m)")).toContain("let m = Math.abs(bar.close);");
    });

    it("passes a str.* warn value through verbatim", () => {
        const out = stmts("s = str.tostring(close, fmt)\nplot(close)");
        expect(out.join(" ")).toContain("str.tostring");
        expect(codes("s = str.tostring(close, fmt)\nplot(close)")).toContain(
            "pine-converter/transform/str-format-not-mapped",
        );
    });

    it("lowers a strategy signal inside an if branch", () => {
        const out = stmts('if close > open\n    strategy.entry("Long", strategy.long)');
        expect(out.join(" ")).toContain('alert("Long entry", { severity: "info" })');
    });

    it("lowers a special call used as a bare statement", () => {
        expect(stmts('request.security(syminfo.tickerid, "D", close)')).toContain(
            'request.security({ interval: "1d" }).close;',
        );
        expect(stmts("ta.ema(close, 9)").some((s) => s.startsWith("ta.ema("))).toBe(true);
    });

    it("emits an unknown bare call statement through verbatim", () => {
        expect(stmts("runtime.log(close)")).toContain("runtime.log(bar.close);");
    });

    it("emits an unknown bare identifier callee statement verbatim", () => {
        expect(stmts("doThing(close)")).toContain("doThing(bar.close);");
    });

    it("defaults a color-literal var to a state.float slot with the type-defaulted info", () => {
        const { scaffold, diagnostics } = run("var c = #ff0000\nplot(close)");
        expect(scaffold.stateSlots[0].initExpr).toBe('state.float("#ff0000")');
        expect(diagnostics.toArray().map((d) => d.code)).toContain(
            "pine-converter/transform/scalar-state-type-defaulted",
        );
    });

    it("skips a malformed array-typed handle decl and its ring push", () => {
        const out = stmts(
            "var line[] xs = array.new<line>()\narray.push(xs, line.new(bar_index, close, bar_index, close))\nif array.size(xs) >= 3\n    line.delete(array.shift(xs))\nplot(close)",
        );
        expect(out).toEqual(["plot(bar.close);"]);
    });

    it("emits a computed-callee statement through the generic emitter", () => {
        expect(stmts("arr.get(0).foo(close)")).toContain("arr.get(0).foo(bar.close);");
    });

    it("emits a computed-callee value through the generic emitter", () => {
        expect(stmts("v = arr.get(0).foo(close)\nplot(close)")).toContain(
            "let v = arr.get(0).foo(bar.close);",
        );
    });

    it("emits a typed non-handle declaration as a let", () => {
        expect(stmts("float x = 1.5\nplot(x)")).toContain("let x = 1.5;");
    });

    it("drops a plot-family call that lowers to nothing", () => {
        expect(stmts("plot()")).toEqual([]);
    });

    it("ignores a non-literal input.int default when resolving loop bounds", () => {
        // `input.int(close)` is a non-literal default — `inputDefaults` skips it,
        // so a for bound that names it stays unresolvable.
        const src = "len = input.int(close)\nfor i = 0 to len\n    plot(close[i])";
        expect(codes(src)).toContain(
            "pine-converter/transform/loop-bounds-not-literal-for-stateful-body",
        );
    });
});
