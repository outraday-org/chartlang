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

    it("emits a runtime loop for a non-stateful input-bounded for", () => {
        const src =
            "len = input.int(1, maxval=10)\nsum = 0.0\nfor i = 0 to len\n    sum := sum + i";
        expect(stmts(src)).toEqual([
            "let sum = 0.0;",
            "for (let i = 0; i <= (inputs.len as number); i++) { sum = sum + i; }",
        ]);
        expect(codes(src)).not.toContain(
            "pine-converter/transform/loop-unroll-frozen-at-input-default",
        );
    });

    it("warns when a non-stateful input-bounded for has no maxval", () => {
        const src = "len = input.int(1)\nsum = 0.0\nfor i = 0 to len\n    sum := sum + i";
        expect(stmts(src)).toEqual([
            "let sum = 0.0;",
            "for (let i = 0; i <= (inputs.len as number); i++) { sum = sum + i; }",
        ]);
        expect(codes(src)).toContain("pine-converter/transform/loop-bound-input-unbounded");
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

    it("emits every element of a comma multi-assignment subjected switch arm", () => {
        // Task 1 parses `a := 8, b := 21` into TWO arm-body statements; the
        // lowering renders each, in order, before the trailing `break;`.
        expect(
            stmts(
                'a = 0\nb = 0\nsel = input.string("X")\nswitch sel\n    "X" => a := 8, b := 21\n    "Y" => a := 4, b := 10',
            ),
        ).toEqual([
            "let a = 0;",
            "let b = 0;",
            'switch ((inputs.sel as string)) { case "X": { a = 8; b = 21; break; } case "Y": { a = 4; b = 10; break; } }',
        ]);
    });

    it("emits every element of a comma multi-assignment subjectless switch arm", () => {
        expect(
            stmts(
                "a = 0\nb = 0\nswitch\n    close > open => a := 8, b := 21\n    => a := 4, b := 10",
            ),
        ).toEqual([
            "let a = 0;",
            "let b = 0;",
            "if (bar.close > bar.open) { a = 8; b = 21; } else { a = 4; b = 10; }",
        ]);
    });

    it("mixes single- and multi-assignment arms in one switch", () => {
        expect(
            stmts(
                'a = 0\nb = 0\nsel = input.string("X")\nswitch sel\n    "X" => a := 8, b := 21\n    "Y" => a := 4',
            ),
        ).toEqual([
            "let a = 0;",
            "let b = 0;",
            'switch ((inputs.sel as string)) { case "X": { a = 8; b = 21; break; } case "Y": { a = 4; break; } }',
        ]);
    });

    it("unrolls a stateful if-body with no else (else-less branch substitution)", () => {
        const src = "for i = 0 to 1\n    if close[i] > 0\n        plot(close[i])";
        const out = stmts(src).join(" ");
        expect(out).toContain("if (bar.close[0] > 0) { plot(bar.close[0]); }");
        expect(out).toContain("if (bar.close[1] > 0) { plot(bar.close[1]); }");
    });

    it("rejects a stateful loop body that contains break/continue (cannot unroll or run)", () => {
        // The OLD behaviour unrolled this and emitted a `break;` at the top
        // level of the unrolled body — a JS syntax error. A `break`/`continue`
        // body cannot unroll AND a stateful call cannot live in a runtime loop,
        // so the loop is now a hard reject.
        const src =
            "for i = 0 to 1\n    if close > open\n        plot(close)\n        break\n    continue";
        expect(stmts(src)).toEqual([]);
        expect(codes(src)).toContain("pine-converter/transform/stateful-loop-with-break");
    });

    it("detects a stateful primitive nested in a for/switch/block inside the loop body", () => {
        const nestedFor = "for i = 0 to 1\n    for j = 0 to 1\n        plot(close[j])";
        expect(stmts(nestedFor).every((s) => s.startsWith("plot("))).toBe(true);
        const nestedSwitch =
            "x = 1\nfor i = 0 to 1\n    switch x\n        1 => plot(close)\n        => plot(open)";
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

describe("transformOther — break / continue loops (no unroll)", () => {
    it("emits a runtime for with break inside it for a literal-bounded non-stateful body", () => {
        const src = "c = 0\nfor i = 0 to 3\n    if close[i] > 0\n        break\n    c += 1";
        expect(stmts(src)).toEqual([
            "let c = 0;",
            "for (let i = 0; i <= 3; i++) { if (bar.close[i] > 0) { break; } c += 1; }",
        ]);
        // A break-loop is NEVER unrolled — no per-iteration copies.
        expect(codes(src)).not.toContain("pine-converter/transform/loop-body-unrolled");
    });

    it("lowers continue inside the runtime for", () => {
        const src = "c = 0\nfor i = 0 to 2\n    if close[i] > 0\n        continue\n    c += 1";
        expect(stmts(src).join(" ")).toContain("continue;");
    });

    it("freezes an input.int break-loop bound and runs as a runtime for (not an unroll)", () => {
        const src =
            "n = input.int(4)\nc = 0\nfor i = 0 to n\n    if close[i] > 0\n        break\n    c += 1";
        expect(stmts(src).join(" ")).toContain("for (let i = 0; i <= 4; i++) {");
        expect(codes(src)).toContain(
            "pine-converter/transform/loop-unroll-frozen-at-input-default",
        );
    });

    it("rejects a non-resolvable break-loop bound", () => {
        const src =
            "n = close\nc = 0\nfor i = 0 to n\n    if close[i] > 0\n        break\n    c += 1";
        expect(stmts(src)).toEqual(["let n = bar.close;", "let c = 0;"]);
        expect(codes(src)).toContain(
            "pine-converter/transform/loop-bounds-not-literal-for-stateful-body",
        );
    });

    it("raises break-continue-outside-loop for a break with no enclosing loop", () => {
        const src = "x = 1\nif x > 0\n    break";
        expect(stmts(src).join(" ")).not.toContain("break;");
        expect(codes(src)).toContain("pine-converter/transform/break-continue-outside-loop");
    });

    it("raises break-continue-outside-loop for a top-level continue", () => {
        const src = "continue";
        expect(stmts(src)).toEqual([]);
        expect(codes(src)).toContain("pine-converter/transform/break-continue-outside-loop");
    });
});

describe("transformOther — compound assignment", () => {
    it("lowers compound operators on a plain local at top level", () => {
        expect(stmts("x = 5\nx += 2\nx -= 1\nx *= 3\nx /= 2")).toEqual([
            "let x = 5;",
            "x += 2;",
            "x -= 1;",
            "x *= 3;",
            "x /= 2;",
        ]);
    });

    it("lowers a compound assignment inside a loop body", () => {
        const src = "c = 0\nfor i = 0 to 2\n    c += i";
        expect(stmts(src).join(" ")).toContain("c += i;");
    });

    it("lowers a compound assignment onto a var state slot's .value", () => {
        // A history-indexed var would be a series slot; a plain var int is a
        // scalar `state.int` slot whose compound write goes through `.value`.
        expect(stmts("var int n = 0\nn += 1").join(" ")).toContain("n.value += 1;");
    });
});

describe("transformOther — calendar built-in calls", () => {
    it("lowers a top-level time()/time_close()/dayofweek() call to the time.* accessor", () => {
        expect(stmts("openT = time()\nplot(openT)")).toEqual([
            "let openT = bar.time;",
            "plot(openT);",
        ]);
        expect(stmts("closeT = time_close()\nplot(closeT)")).toEqual([
            "let closeT = time.timeClose(bar.time);",
            "plot(closeT);",
        ]);
        expect(stmts("dow = dayofweek(time)\nplot(dow)")).toEqual([
            "let dow = time.dayofweek(bar.time);",
            "plot(dow);",
        ]);
    });

    it("threads the timezone arg through dayofweek(t, tz)", () => {
        expect(stmts('dow = dayofweek(time, "America/New_York")\nplot(dow)')).toEqual([
            'let dow = time.dayofweek(bar.time, "America/New_York");',
            "plot(dow);",
        ]);
    });

    it("warns time-builtin-not-mapped for an unsupported time(timeframe) shape", () => {
        const src = "t = time(timeframe.period)\nplot(t)";
        expect(codes(src)).toContain("pine-converter/transform/time-builtin-not-mapped");
        expect(stmts(src)[0]).toContain("/* TODO unmapped */");
    });

    it("lowers a bare dayofweek/time_close/timenow value read to the time accessor", () => {
        expect(stmts("dow = dayofweek\nplot(dow)")[0]).toBe("let dow = time.dayofweek(bar.time);");
        expect(stmts("ct = time_close\nplot(ct)")[0]).toBe("let ct = time.timeClose(bar.time);");
        expect(stmts("live = timenow\nplot(live)")[0]).toBe("let live = time.now();");
    });
});

describe("transformOther — scalars", () => {
    it("casts native enum inputs as string and lowers enum member comparisons", () => {
        expect(
            stmts(
                [
                    'enum Signal\n    buy = "Buy Signal"\n    sell = "Sell Signal"',
                    "sig = input.enum(Signal.buy)",
                    "isSell = sig == Signal.sell",
                    "plot(isSell ? 1 : 0)",
                ].join("\n"),
            ),
        ).toEqual([
            'let isSell = (inputs.sig as string) == "Sell Signal";',
            "plot(isSell ? 1 : 0);",
        ]);
    });

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

describe("transformOther — series scalars (state.series)", () => {
    it("lowers an na-init numeric var read with [n] to a state.series slot", () => {
        const { scaffold } = run(
            "var float prev = na\ndelta = close - prev\nprev := close\nplot(delta)\nplot(prev[1])",
        );
        expect(scaffold.stateSlots).toEqual([
            { name: "prev", initExpr: "state.series(Number.NaN)" },
        ]);
        expect(scaffold.computeBody.statements).toEqual([
            "let delta = bar.close - prev.value;",
            "prev.value = bar.close;",
            "plot(delta);",
            "plot(prev[1]);",
        ]);
    });

    it("lowers a literal-numeric var read with [n] to a state.series slot", () => {
        const { scaffold } = run("var float acc = 0.0\nacc := acc + close\nplot(acc[2])");
        expect(scaffold.stateSlots).toEqual([{ name: "acc", initExpr: "state.series(0.0)" }]);
        expect(scaffold.computeBody.statements).toEqual([
            "acc.value = acc.value + bar.close;",
            "plot(acc[2]);",
        ]);
    });

    it("keeps a numeric var NOT read with [n] as a leaner scalar slot", () => {
        const { scaffold } = run("var int n = 0\nn := n + 1\nplot(n)");
        expect(scaffold.stateSlots).toEqual([{ name: "n", initExpr: "state.int(0)" }]);
    });

    it("defaults an un-inferable-init numeric series to state.series(Number.NaN)", () => {
        const { scaffold, diagnostics } = run(
            "var float seed = close\nseed := close\nplot(seed[1])",
        );
        expect(scaffold.stateSlots).toEqual([
            { name: "seed", initExpr: "state.series(Number.NaN)" },
        ]);
        expect(diagnostics.toArray().map((d) => d.code)).toContain(
            "pine-converter/transform/scalar-state-type-defaulted",
        );
    });

    it("approximates a varip numeric series as a non-tick state.series", () => {
        const { scaffold, diagnostics } = run("varip float vp = 0.0\nvp := close\nplot(vp[1])");
        expect(scaffold.stateSlots).toEqual([{ name: "vp", initExpr: "state.series(0.0)" }]);
        expect(diagnostics.toArray().map((d) => d.code)).toContain(
            "pine-converter/transform/varip-series-approximated",
        );
    });

    it("lowers a history-indexed bool var to a state.boolSeries slot", () => {
        const { scaffold, diagnostics } = run(
            "var bool up = false\nup := close > open\nplot(up[1] ? 1 : 0)",
        );
        expect(scaffold.stateSlots).toEqual([{ name: "up", initExpr: "state.boolSeries(false)" }]);
        // The value write, value read, and bare `[n]` history read.
        expect(scaffold.computeBody.statements).toEqual([
            "up.value = bar.close > bar.open;",
            "plot(up[1] ? 1 : 0);",
        ]);
        expect(diagnostics.toArray().map((d) => d.code)).not.toContain(
            "pine-converter/transform/series-history-non-numeric",
        );
    });

    it("seeds an na-init bool series with the v6 first-bar default (false)", () => {
        const { scaffold, diagnostics } = run(
            "var bool flag = na\nflag := close > open\nplot(flag[1] ? 1 : 0)",
        );
        expect(scaffold.stateSlots).toEqual([
            { name: "flag", initExpr: "state.boolSeries(false)" },
        ]);
        expect(diagnostics.toArray().map((d) => d.code)).not.toContain(
            "pine-converter/transform/series-history-non-numeric",
        );
    });

    it("lowers a history-indexed string var to a state.stringSeries slot", () => {
        const { scaffold } = run(
            'var string suffix = "-"\nsuffix := "+"\nplot(suffix[1] == "-" ? 1 : 0)',
        );
        expect(scaffold.stateSlots).toEqual([
            { name: "suffix", initExpr: 'state.stringSeries("-")' },
        ]);
    });

    it("seeds an na-init string series with the empty-string default", () => {
        const { scaffold } = run('var string s = na\ns := "x"\nplot(s[1] == "" ? 1 : 0)');
        expect(scaffold.stateSlots).toEqual([{ name: "s", initExpr: 'state.stringSeries("")' }]);
    });

    it("promotes cross-UDF history args through direct / binary / unary / ternary / paren nestings", () => {
        // `cf_s` history-indexes its param, so each SIMPLE-IDENTIFIER series-local
        // argument is promoted to a `state.series` slot regardless of the call's
        // nesting; a non-identifier arg (`close + 1`) is left alone.
        const { scaffold } = run(
            "cf_s(m) => ta.ema(m - m[1], 3)\n" +
                "a = ta.sma(close, 3)\n" +
                "b = ta.sma(close, 5)\n" +
                "c = ta.sma(close, 8)\n" +
                "d = ta.sma(close, 13)\n" +
                "float v = 3.0\n" +
                "r1 = cf_s(a)\n" +
                "r2 = cf_s(b) + 1\n" +
                "r3 = -cf_s(c)\n" +
                "r4 = close > open ? cf_s(d) : 0\n" +
                "r5 = (cf_s(a))\n" +
                "r6 = cf_s(close + 1)\n" +
                "plot(r1)\nplot(r2)\nplot(r3)\nplot(r4)\nplot(r5)\nplot(r6)",
        );
        const slotted = new Set(scaffold.stateSlots.map((slot) => slot.name));
        for (const name of ["a", "b", "c", "d"]) {
            expect(slotted.has(name)).toBe(true);
        }
        // The typed `float v` is not history-indexed → stays a plain scalar slot.
        expect(slotted.has("v")).toBe(false);
    });

    it("seeds a non-indexed na-init string scalar with an empty string", () => {
        // A `var string` initialised to `na` but NEVER history-indexed gets no
        // series slot. Seed it with Pine's effective empty-string default so
        // downstream string-typed calls do not see a `string | null` union.
        expect(stmts('var string mode = na\nmode := "EMA"\nplot(close)')).toContain(
            'let mode = "";',
        );
    });

    it("keeps non-indexed bool na as the existing null-union sentinel", () => {
        expect(stmts("var bool armed = na\narmed := close > open\nplot(close)")).toContain(
            "let armed: boolean | null = null;",
        );
    });

    it("keeps numeric na declarations on the Number.NaN path", () => {
        expect(stmts("var float prev = na\nprev := close\nplot(prev)")).toContain(
            "let prev = Number.NaN;",
        );
    });

    it("wires dynamic-series-index for a dynamic offset on a bool series", () => {
        const { diagnostics } = run(
            "var bool up = false\ni = 2\nup := close > open\nplot(up[i] ? 1 : 0)",
        );
        expect(diagnostics.toArray().map((d) => d.code)).toContain(
            "pine-converter/transform/dynamic-series-index",
        );
    });

    it("lowers a `var color = na` scalar to a transparent state.color slot", () => {
        const { scaffold, diagnostics } = run(
            "var color c = na\nc := close > open ? color.green : color.red\nplot(c == color.green ? 1 : 0)",
        );
        expect(scaffold.stateSlots).toEqual([{ name: "c", initExpr: 'state.color("#00000000")' }]);
        expect(scaffold.computeBody.statements).toEqual([
            "c.value = (bar.close > bar.open) ? color.green : color.red;",
            "plot((c.value == color.green) ? 1 : 0);",
        ]);
        // A color scalar is now first-class — no defaulting / non-numeric info.
        expect(diagnostics.toArray().map((d) => d.code)).not.toContain(
            "pine-converter/transform/scalar-state-type-defaulted",
        );
    });

    it("infers state.color from a color-valued initializer with no annotation", () => {
        const { scaffold } = run("var c = color.red\nc := color.green\nplot(close)");
        expect(scaffold.stateSlots).toEqual([{ name: "c", initExpr: "state.color(color.red)" }]);
    });

    it("approximates a varip color scalar as a non-tick state.color", () => {
        const { scaffold, diagnostics } = run("varip color c = na\nc := color.red\nplot(close)");
        expect(scaffold.stateSlots).toEqual([{ name: "c", initExpr: 'state.color("#00000000")' }]);
        expect(diagnostics.toArray().map((d) => d.code)).toContain(
            "pine-converter/transform/varip-series-approximated",
        );
    });

    it("wires dynamic-series-index for a non-literal series-slot offset", () => {
        const { scaffold, diagnostics } = run(
            "var float prev = na\ni = 2\nprev := close\nplot(prev[i])",
        );
        expect(scaffold.stateSlots).toEqual([
            { name: "prev", initExpr: "state.series(Number.NaN)" },
        ]);
        expect(diagnostics.toArray().map((d) => d.code)).toContain(
            "pine-converter/transform/dynamic-series-index",
        );
    });

    it("treats a unary non-literal offset (`x[-i]`) as a dynamic series index", () => {
        const { diagnostics } = run("var float prev = na\ni = 2\nprev := close\nplot(prev[-i])");
        expect(diagnostics.toArray().map((d) => d.code)).toContain(
            "pine-converter/transform/dynamic-series-index",
        );
    });

    it("accepts a unary-literal offset (`x[-1]`) without a dynamic-series-index", () => {
        const { diagnostics } = run("var float prev = na\nprev := close\nplot(prev[-1])");
        expect(diagnostics.toArray().map((d) => d.code)).not.toContain(
            "pine-converter/transform/dynamic-series-index",
        );
    });

    it("treats a bare (untyped) na-init var read with [n] as a numeric series", () => {
        const { scaffold } = run("var p = na\np := close\nplot(p[1])");
        expect(scaffold.stateSlots).toEqual([{ name: "p", initExpr: "state.series(Number.NaN)" }]);
    });

    it("ignores a history access whose receiver is not a bare identifier", () => {
        // `(close - open)[1]` has a non-identifier receiver — no scalar slot to
        // promote, so the var stays a leaner scalar and no series slot appears.
        const { scaffold } = run("var float n = 0.0\nn := close\nplot((close - open)[1])");
        expect(scaffold.stateSlots).toEqual([{ name: "n", initExpr: "state.float(0.0)" }]);
    });

    it("keeps a history-indexed color var as a scalar state.color + flags the gap", () => {
        const { scaffold, diagnostics } = run(
            "var color c = na\nc := color.red\nplot(c[1] == color.red ? 1 : 0)",
        );
        // Color HISTORY is deferred (no `state.colorSeries`): the slot stays the
        // scalar `state.color`, and the `[n]` gap is flagged (never silent).
        expect(scaffold.stateSlots).toEqual([{ name: "c", initExpr: 'state.color("#00000000")' }]);
        expect(diagnostics.toArray().map((d) => d.code)).toContain(
            "pine-converter/transform/series-history-non-numeric",
        );
    });
});

describe("transformOther — ta-series promotion (state.series)", () => {
    it("promotes an `=`-declared, history-indexed ta-series to a state.series slot", () => {
        const { scaffold, diagnostics } = run(
            "ma = ta.ema(close, 9)\nc = 0\nfor i = 0 to 3\n    if (ma[i] > 0) or (ma[i] < 0)\n        break\n    c += 1\nplot(ma)",
        );
        // The slot is `state.series(Number.NaN)`; the declaration becomes the
        // per-bar `.value` write; `ma[i]` is a real indexed read; `ma` reads as
        // `ma.value`. A loop-bound `[i]` is NOT a `dynamic-series-index`.
        expect(scaffold.stateSlots).toContainEqual({
            name: "ma",
            initExpr: "state.series(Number.NaN)",
        });
        const body = scaffold.computeBody.statements.join(" ");
        expect(body).toContain("ma.value = ta.ema(bar.close, 9).current;");
        expect(body).toContain("if ((ma[i] > 0) || (ma[i] < 0)) { break; }");
        expect(body).toContain("plot(ma.value);");
        expect(diagnostics.toArray().map((d) => d.code)).not.toContain(
            "pine-converter/transform/dynamic-series-index",
        );
    });

    it("keeps a never-`[n]`-indexed ta-series as a `.current` scalar (no slot)", () => {
        const { scaffold } = run("ma = ta.ema(close, 9)\nplot(ma)");
        expect(scaffold.stateSlots).toEqual([]);
        expect(scaffold.computeBody.statements.join(" ")).toContain(
            "let ma = ta.ema(bar.close, 9).current;",
        );
    });

    it("wires dynamic-series-index for a non-loop-bound ta-series offset (read twice)", () => {
        // `j` is a plain local, not a loop iterator — a genuinely dynamic offset.
        // Indexed twice so the `prior.dynamicSpan` keep-first branch is hit.
        const { scaffold, diagnostics } = run(
            "ma = ta.ema(close, 9)\nj = 2\nx = ma[j] + ma[j]\nplot(x)",
        );
        expect(scaffold.stateSlots).toContainEqual({
            name: "ma",
            initExpr: "state.series(Number.NaN)",
        });
        expect(diagnostics.toArray().map((d) => d.code)).toContain(
            "pine-converter/transform/dynamic-series-index",
        );
    });

    it("does not promote an input call or a const non-call, but promotes a series-rooted indexed decl", () => {
        // `input.int(...)` (input-qualified) and `cc = 0` (const) never promote;
        // `q = close[1].max(open)` is OHLCV-rooted (series) and history-indexed
        // (`q[1]`), so A1 promotes it to a `state.series` slot — without the slot
        // the `q[1]` read would index a plain `number` (TS7053).
        const { scaffold } = run(
            "n = input.int(4)\ncc = 0\nq = close[1].max(open)\nplot(q[1])\nplot(n)\nplot(cc)",
        );
        expect(scaffold.stateSlots).toEqual([{ name: "q", initExpr: "state.series(Number.NaN)" }]);
    });

    it("promotes a series-rooted decl whose value also names an unmodelled identifier", () => {
        // `foo` is neither a user symbol nor a builtin, so the A1 resolver returns
        // `null` (its `?? null` fallback) and `inferQualifier` treats it as `const`;
        // joined with the series `close`, `v` is still series-qualified and, being
        // history-indexed (`v[1]`), promotes to a `state.series` slot.
        const { scaffold } = run("v = foo + close\nplot(v[1])");
        expect(scaffold.stateSlots).toEqual([{ name: "v", initExpr: "state.series(Number.NaN)" }]);
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
        // `nz(x, r)` lowers to the scalar `math.nz(x, r)`; the assignment still
        // emits with a trailing semicolon.
        expect(stmts("y = 0\ny := nz(close, 0)")).toContain("y = math.nz(bar.close, 0);");
    });

    it("lowers request.security as a declaration value", () => {
        expect(stmts('htf = request.security(syminfo.tickerid, "1D", close)\nplot(htf)')).toContain(
            'let htf = request.security({ interval: "1d" }).close.current;',
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

    it("lowers alert(message, freq) inside an if, dropping the frequency", () => {
        const out = stmts('if close > open\n    alert("hi", alert.freq_all)');
        expect(out.join(" ")).toContain('if (bar.close > bar.open) { alert("hi"); }');
        expect(out.join(" ")).not.toContain("alert.freq_all");
        expect(codes('if close > open\n    alert("hi", alert.freq_all)')).toContain(
            "pine-converter/transform/alert-frequency-not-mapped",
        );
    });

    it("lowers a special call used as a bare statement", () => {
        expect(stmts('request.security(syminfo.tickerid, "D", close)')).toContain(
            'request.security({ interval: "1d" }).close.current;',
        );
        expect(stmts("ta.ema(close, 9)").some((s) => s.startsWith("ta.ema("))).toBe(true);
    });

    it("emits an unknown bare call statement through verbatim", () => {
        expect(stmts("runtime.log(close)")).toContain("runtime.log(bar.close);");
    });

    it("emits an unknown bare identifier callee statement verbatim", () => {
        expect(stmts("doThing(close)")).toContain("doThing(bar.close);");
    });

    it("infers a color-literal var as a state.color slot (no type-defaulting)", () => {
        const { scaffold, diagnostics } = run("var c = #ff0000\nplot(close)");
        expect(scaffold.stateSlots[0].initExpr).toBe('state.color("#ff0000")');
        expect(diagnostics.toArray().map((d) => d.code)).not.toContain(
            "pine-converter/transform/scalar-state-type-defaulted",
        );
    });

    it("defaults a parser-unreachable literal kind to state.float (synthetic AST)", () => {
        // The parser emits `na` as an `na-expression`, never a `literal-expression`
        // with `literalKind: "na"`, and a color literal is intercepted as
        // `state.color` upstream — so `factoryForLiteralKind`'s default arm is
        // unreachable from real source. Exercise it with a synthetic AST (the
        // established defensive-arm precedent).
        const src = `//@version=6\nindicator("X")\nvar x = 0\nplot(x)\n`;
        const analysis = analyze(parseStatements(lex(src).tokens).script);
        const decl0 = analysis.script.body[0];
        if (
            decl0 === undefined ||
            decl0.kind !== "variable-declaration" ||
            decl0.initializer.kind !== "literal-expression"
        ) {
            throw new Error("expected a literal-init variable declaration");
        }
        const patchedBody = [
            { ...decl0, initializer: { ...decl0.initializer, literalKind: "na" as const } },
            ...analysis.script.body.slice(1),
        ];
        const patched = {
            ...analysis,
            script: { ...analysis.script, body: patchedBody },
        };
        const top = patched.script.declaration;
        if (top === null || top.kind !== "indicator-declaration") {
            throw new Error("expected an indicator declaration");
        }
        const diagnostics = new DiagnosticCollector();
        const scaffold = transformDeclaration(top, patched, diagnostics);
        transformOther(patched, scaffold, diagnostics);
        expect(scaffold.stateSlots).toEqual([{ name: "x", initExpr: "state.float(0)" }]);
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
