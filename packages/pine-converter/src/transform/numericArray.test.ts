// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { Declaration } from "../ast/script.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { analyze } from "../semantic/index.js";
import { transformDeclaration } from "./declaration.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import type { ScriptScaffold } from "./ir.js";
import { scanNumericArrays } from "./numericArray.js";
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
    transformOther(analysis, scaffold, diagnostics);
    return { scaffold, diagnostics };
}

function slots(body: string): readonly { name: string; initExpr: string }[] {
    return run(body).scaffold.stateSlots;
}

function stmts(body: string): readonly string[] {
    return run(body).scaffold.computeBody.statements;
}

function codes(body: string): string[] {
    return run(body)
        .diagnostics.toArray()
        .map((d) => d.code);
}

const RING = "var array<float> win = array.new<float>()\narray.push(win, close)\n";
const EVICT = "if array.size(win) > 20\n    array.shift(win)\n";

describe("numeric array — bounded ring lowering", () => {
    it("lowers a bounded numeric `var array<float>` to `state.array<number>(K)`", () => {
        expect(slots(`${RING}${EVICT}`)).toEqual([
            { name: "win", initExpr: "state.array<number>(20)" },
        ]);
    });

    it("rewrites push onto the slot and elides the eviction block", () => {
        expect(stmts(`${RING}${EVICT}plot(array.last(win))`)).toEqual([
            "win.push(bar.close);",
            "plot(win.last());",
        ]);
    });

    it("emits one `ring-eviction-implicit` info for the elided FIFO block", () => {
        expect(codes(`${RING}${EVICT}plot(array.size(win))`)).toEqual([
            "pine-converter/transform/ring-eviction-implicit",
        ]);
    });

    it("maps array.get / array.size / array.last / array.first / array.clear", () => {
        const body = `${RING}${EVICT}a = array.get(win, 2)
b = array.size(win)
c = array.last(win)
d = array.first(win)
array.clear(win)
plot(a + b + c + d)`;
        expect(stmts(body)).toEqual([
            "win.push(bar.close);",
            "let a = win.get(win.size - 1 - (2));",
            "let b = win.size;",
            "let c = win.last();",
            "let d = win.get(win.size - 1);",
            "win.clear();",
            "plot(((a + b) + c) + d);",
        ]);
    });

    it("reads the cap from an `array.new<float>(K)` size argument", () => {
        const body = "var array<float> win = array.new<float>(8)\narray.push(win, close)\n";
        expect(slots(body)).toEqual([{ name: "win", initExpr: "state.array<number>(8)" }]);
    });

    it("prefers the eviction-guard cap over the `array.new` size", () => {
        const body =
            "var array<float> win = array.new<float>(8)\n" +
            "array.push(win, close)\n" +
            "if array.size(win) > 30\n    array.shift(win)\n";
        expect(slots(body)).toEqual([{ name: "win", initExpr: "state.array<number>(30)" }]);
    });

    it("accepts an `array.remove(coll, 0)` FIFO eviction", () => {
        const body = `${RING}if array.size(win) >= 12\n    array.remove(win, 0)\nplot(array.size(win))`;
        expect(slots(body)).toEqual([{ name: "win", initExpr: "state.array<number>(12)" }]);
        expect(codes(body)).toEqual(["pine-converter/transform/ring-eviction-implicit"]);
    });

    it("lowers an `int` array the same as a `float` array", () => {
        const body =
            "var array<int> n = array.new<int>()\narray.push(n, 1)\nif array.size(n) > 5\n    array.shift(n)\n";
        expect(slots(body)).toEqual([{ name: "n", initExpr: "state.array<number>(5)" }]);
    });

    it("defaults a no-annotation `array.new` to numeric", () => {
        const body = "var win = array.new<float>(4)\narray.push(win, close)\nplot(array.last(win))";
        expect(slots(body)).toEqual([{ name: "win", initExpr: "state.array<number>(4)" }]);
    });

    it("lowers a `varip` numeric array the same as `var`", () => {
        const body = "varip array<float> win = array.new<float>(6)\narray.push(win, close)\n";
        expect(slots(body)).toEqual([{ name: "win", initExpr: "state.array<number>(6)" }]);
    });
});

describe("numeric array — rejections", () => {
    it("rejects a non-numeric `array<string>` with `array-collection-non-numeric`", () => {
        const body = 'var array<string> tags = array.new<string>()\narray.push(tags, "x")\n';
        expect(slots(body)).toEqual([]);
        expect(codes(body)).toContain("pine-converter/transform/array-collection-non-numeric");
    });

    it("hard-rejects an unbounded numeric array with `unbounded-array-collection`", () => {
        const body =
            "var array<float> win = array.new<float>()\narray.push(win, close)\nplot(array.size(win))";
        expect(slots(body)).toEqual([]);
        expect(codes(body)).toContain("pine-converter/transform/unbounded-array-collection");
    });

    it("treats a zero / negative eviction cap as unbounded", () => {
        const body =
            "var array<float> win = array.new<float>()\narray.push(win, close)\nif array.size(win) > 0\n    array.shift(win)\n";
        expect(slots(body)).toEqual([]);
        expect(codes(body)).toContain("pine-converter/transform/unbounded-array-collection");
    });

    it("treats a zero `array.new(0)` size as unbounded", () => {
        const body = "var array<float> win = array.new<float>(0)\narray.push(win, close)\n";
        expect(slots(body)).toEqual([]);
        expect(codes(body)).toContain("pine-converter/transform/unbounded-array-collection");
    });

    it("rejects a `color` array as non-numeric", () => {
        const body = "var array<color> cs = array.new<color>()\narray.push(cs, color.red)\n";
        expect(slots(body)).toEqual([]);
        expect(codes(body)).toContain("pine-converter/transform/array-collection-non-numeric");
    });

    it("does not treat an eviction guard with a non-shift body as a cap", () => {
        // The guard body does not remove the head, so it is not an eviction
        // signature; with no `array.new(K)` size either, the array is unbounded.
        const body =
            "var array<float> win = array.new<float>()\n" +
            "array.push(win, close)\n" +
            "if array.size(win) > 9\n    plot(close)\n";
        expect(slots(body)).toEqual([]);
        expect(codes(body)).toContain("pine-converter/transform/unbounded-array-collection");
    });

    it("does not treat a non-array.size guard as eviction", () => {
        const body =
            "var array<float> win = array.new<float>()\n" +
            "array.push(win, close)\n" +
            "if close > 9\n    array.shift(win)\n";
        expect(slots(body)).toEqual([]);
        expect(codes(body)).toContain("pine-converter/transform/unbounded-array-collection");
    });

    it("treats a negative `array.new(-3)` size as unbounded", () => {
        const body = "var array<float> win = array.new<float>(-3)\narray.push(win, close)\n";
        expect(slots(body)).toEqual([]);
        expect(codes(body)).toContain("pine-converter/transform/unbounded-array-collection");
    });

    it("reads a unary-plus `array.new(+8)` size as the cap", () => {
        const body = "var array<float> win = array.new<float>(+8)\narray.push(win, close)\n";
        expect(slots(body)).toEqual([{ name: "win", initExpr: "state.array<number>(8)" }]);
    });

    it("ignores a guard whose array.size argument is not a bare identifier", () => {
        // `array.size(close[0])` does not name the collection, so it never caps
        // `win`; with no other cap the array stays unbounded.
        const body =
            "var array<float> win = array.new<float>()\n" +
            "array.push(win, close)\n" +
            "if array.size(close[0]) > 9\n    array.shift(win)\n";
        expect(slots(body)).toEqual([]);
        expect(codes(body)).toContain("pine-converter/transform/unbounded-array-collection");
    });

    it("treats a non-literal eviction cap as unbounded", () => {
        const body =
            "k = 9\n" +
            "var array<float> win = array.new<float>()\n" +
            "array.push(win, close)\n" +
            "if array.size(win) > k\n    array.shift(win)\n";
        expect(slots(body)).toEqual([]);
        expect(codes(body)).toContain("pine-converter/transform/unbounded-array-collection");
    });

    it("does not treat a guard whose body nests a statement as eviction", () => {
        const body =
            "var array<float> win = array.new<float>()\n" +
            "array.push(win, close)\n" +
            "if array.size(win) > 9\n    if close > 0\n        array.shift(win)\n";
        expect(slots(body)).toEqual([]);
        expect(codes(body)).toContain("pine-converter/transform/unbounded-array-collection");
    });
});

describe("numeric array — operation mapping edge cases", () => {
    it("emits a placeholder + diagnostic for an unmapped `array.*` over a slot", () => {
        // `array.pop` has no reduction mapping, so rather than mis-lowering to
        // broken `array.pop(win)` it emits a `Number.NaN` placeholder and is
        // surfaced via `array-reduction-not-mapped`.
        const body = `${RING}${EVICT}x = array.pop(win)\nplot(x)`;
        expect(stmts(body)).toContain(
            "let x = Number.NaN /* TODO: array.pop not supported in chartlang */;",
        );
        expect(codes(body)).toContain("pine-converter/transform/array-reduction-not-mapped");
    });

    it("lowers the reduction family onto the handle methods", () => {
        const body = `${RING}${EVICT}plot(array.stdev(win))\nplot(array.percentile_linear_interpolation(win, 90))`;
        const lines = stmts(body);
        expect(lines).toContain("plot(win.stdev());");
        expect(lines).toContain("plot(win.percentile(90));");
    });

    it("lowers `array.sort(id, order)` to a copy + raises the in-place caveat", () => {
        const body = `${RING}${EVICT}array.sort(win, order.descending)\nplot(array.get(win, 0))`;
        expect(stmts(body)).toContain('win.sort("desc");');
        expect(codes(body)).toContain("pine-converter/transform/array-sort-returns-copy");
    });

    it("rejects nearest-rank percentile with a placeholder + diagnostic", () => {
        const body = `${RING}${EVICT}plot(array.percentile_nearest_rank(win, 90))`;
        expect(stmts(body)).toContain(
            "plot(Number.NaN /* TODO: array.percentile_nearest_rank not supported in chartlang */);",
        );
        expect(codes(body)).toContain("pine-converter/transform/array-reduction-not-mapped");
    });
});

describe("numeric array — isolation", () => {
    it("does not classify a `var array<line>` handle ring as a numeric array", () => {
        // A drawing-handle ring is an owned drawing site, filtered out of the
        // numeric scan; it lowers to a `useDrawingHandleRing`, not `state.array`.
        const body =
            "var array<line> lvls = array.new<line>()\n" +
            "array.push(lvls, line.new(bar_index, high, bar_index, high))\n" +
            "if array.size(lvls) > 3\n    line.delete(array.shift(lvls))\n";
        expect(slots(body).some((s) => s.initExpr.startsWith("state.array"))).toBe(false);
    });

    it("classifies independently when a numeric and a handle ring coexist", () => {
        const body =
            "var array<line> lvls = array.new<line>()\n" +
            "var array<float> win = array.new<float>()\n" +
            "array.push(lvls, line.new(bar_index, high, bar_index, high))\n" +
            "if array.size(lvls) > 3\n    line.delete(array.shift(lvls))\n" +
            "array.push(win, close)\n" +
            "if array.size(win) > 20\n    array.shift(win)\n";
        expect(slots(body)).toContainEqual({ name: "win", initExpr: "state.array<number>(20)" });
    });

    it("does not lower a numeric array declared only inside an `if` block", () => {
        // A non-top-level decl is not a top-level `var`, so it is not scanned —
        // it falls to the existing (non-array) lowering, never a `state.array`.
        const body = "if close > open\n    win = array.new<float>(5)\n    array.push(win, close)";
        expect(slots(body).some((s) => s.initExpr.startsWith("state.array"))).toBe(false);
    });

    it("does not swallow a scalar `var` next to a numeric array", () => {
        const body = `var float prev = 0.0\n${RING}${EVICT}prev := array.last(win)`;
        const out = slots(body);
        expect(out).toContainEqual({ name: "win", initExpr: "state.array<number>(20)" });
        expect(out).toContainEqual({ name: "prev", initExpr: "state.float(0.0)" });
    });
});

describe("scanNumericArrays", () => {
    function scan(body: string) {
        const src = `//@version=6\nindicator("X")\n${body}\n`;
        const analysis = analyze(parseStatements(lex(src).tokens).script);
        return scanNumericArrays(analysis, new Set());
    }

    it("partitions slots / nonNumeric / unbounded with decl spans", () => {
        const result = scan(`${RING}${EVICT}`);
        expect(result.slots.get("win")?.cap).toBe(20);
        expect(result.nonNumeric.size).toBe(0);
        expect(result.unbounded.size).toBe(0);
    });

    it("records the non-numeric decl span", () => {
        const result = scan("var array<bool> flags = array.new<bool>()\narray.push(flags, true)");
        expect(result.nonNumeric.has("flags")).toBe(true);
        expect(result.nonNumeric.get("flags")?.startLine).toBe(3);
    });

    it("skips a name already owned by a drawing transform", () => {
        const src =
            '//@version=6\nindicator("X")\nvar array<float> win = array.new<float>(5)\narray.push(win, close)\n';
        const analysis = analyze(parseStatements(lex(src).tokens).script);
        const result = scanNumericArrays(analysis, new Set(["win"]));
        expect(result.slots.size).toBe(0);
    });
});
