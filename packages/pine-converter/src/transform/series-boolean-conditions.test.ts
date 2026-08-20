// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { compile } from "@invinite-org/chartlang-compiler";
import { describe, expect, it } from "vitest";

import { convert } from "../index.js";

// The reproduction from Invinite's order-backtest QA pass, verbatim: an
// ordinary Pine v5 EMA-crossover strategy. Before the scalar-condition rule,
// `@invinite-org/chartlang-pine-converter@0.9.1` emitted
// `if (ta.crossover(fast, slow))`. chartlang's `ta.crossover`/`ta.crossunder`
// return `Series<boolean>`, and a Series OBJECT is truthy on every bar, so BOTH
// order branches ran on EVERY bar (a 1,000-bar AAPL/1D backtest consumed 2,000
// orders and opened 999 same-day round trips).
const EMA_CROSSOVER_PINE = `//@version=5
strategy("EMA Crossover", overlay=true)
fast = ta.ema(close, 12)
slow = ta.ema(close, 26)
if ta.crossover(fast, slow)
    strategy.entry("Long", strategy.long, qty=2)
if ta.crossunder(fast, slow)
    strategy.close("Long")
`;

// The converted chartlang source, through the PUBLIC package API.
function output(pine: string): string {
    const result = convert(pine);
    expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    const source = result.output;
    if (source === null) {
        throw new Error("conversion produced no output");
    }
    return source;
}

// Every `if (…)` / `else if (…)` predicate in an emitted program, extracted by
// paren matching so the assertions read the REAL generated text rather than a
// restatement of it.
function predicatesOf(source: string): readonly string[] {
    const found: string[] = [];
    const opener = /\bif \(/g;
    let match = opener.exec(source);
    while (match !== null) {
        let depth = 1;
        let index = match.index + match[0].length;
        const start = index;
        while (index < source.length && depth > 0) {
            const char = source[index];
            if (char === "(") {
                depth += 1;
            } else if (char === ")") {
                depth -= 1;
            }
            index += 1;
        }
        found.push(source.slice(start, index - 1));
        match = opener.exec(source);
    }
    return found;
}

// Evaluate a generated predicate against a Series-SHAPED stub: `ta.crossover`
// and `ta.crossunder` return `{ current }` objects, exactly the shape chartlang
// hands the script. The stub is the whole point of the test — a predicate that
// tests the OBJECT is truthy even when `current` is `false`, so this
// distinguishes "reads the bar's value" from "an object exists".
function evaluatePredicate(predicate: string, current: boolean): unknown {
    const series = { current };
    const ta = {
        crossover: () => series,
        crossunder: () => series,
        ema: () => series,
    };
    const bar = { close: 1, open: 2, high: 3, low: 0 };
    // Evaluating the converter's OWN emitted predicate is the proof; a
    // restated string would only test the expectation.
    const fn = new Function("ta", "bar", "fast", "slow", "inputs", `return (${predicate});`) as (
        taArg: typeof ta,
        barArg: typeof bar,
        fastArg: number,
        slowArg: number,
        inputsArg: Record<string, unknown>,
    ) => unknown;
    return fn(ta, bar, 1, 2, { useIt: true });
}

describe("series-boolean control-flow predicates read the current bar", () => {
    it("lowers both predicates of the exact EMA crossover reproduction", () => {
        const source = output(EMA_CROSSOVER_PINE);
        expect(source).toContain("if (ta.crossover(fast, slow).current)");
        expect(source).toContain("if (ta.crossunder(fast, slow).current)");
        // The shipped-0.9.1 shape must be gone, not merely accompanied.
        expect(source).not.toContain("if (ta.crossover(fast, slow))");
        expect(source).not.toContain("if (ta.crossunder(fast, slow))");
    });

    it("the reproduction's emitted predicates are event-driven, not object-truthy", () => {
        const predicates = predicatesOf(output(EMA_CROSSOVER_PINE));
        expect(predicates).toHaveLength(2);
        for (const predicate of predicates) {
            expect(evaluatePredicate(predicate, true)).toBe(true);
            expect(evaluatePredicate(predicate, false)).toBe(false);
        }
        // The pre-fix shape, evaluated through the SAME stub, is truthy on a
        // bar where no cross happened — the defect this rule removes.
        expect(evaluatePredicate("ta.crossover(fast, slow)", false)).toBeTruthy();
    });

    // A real `compile(...)` under v8 coverage instrumentation runs well past
    // vitest's 5s default (`fixtures-compile.test.ts` sees 2s+ per fixture), so
    // this one names its own budget rather than flaking the suite.
    it("the reproduction still compiles through the chartlang compiler", async () => {
        const compiled = await compile(output(EMA_CROSSOVER_PINE), {
            apiVersion: 1,
            sourcePath: "ema-crossover.chart.ts",
        });
        expect(compiled.moduleSource.length).toBeGreaterThan(0);
    }, 60_000);

    it("covers the initial if, every else if, and parenthesised predicates", () => {
        const source = output(`//@version=5
strategy("P", overlay=true)
fast = ta.ema(close, 12)
slow = ta.ema(close, 26)
if (ta.crossover(fast, slow))
    strategy.entry("Long", strategy.long)
else if (ta.crossunder(fast, slow))
    strategy.close("Long")
`);
        expect(source).toContain("if ((ta.crossover(fast, slow).current))");
        expect(source).toContain("else if ((ta.crossunder(fast, slow).current))");
        for (const predicate of predicatesOf(source)) {
            expect(evaluatePredicate(predicate, false)).toBeFalsy();
        }
    });

    it("lowers a strategy `when =` guard, which becomes the enclosing if", () => {
        const source = output(`//@version=5
strategy("W", overlay=true)
fast = ta.ema(close, 12)
slow = ta.ema(close, 26)
strategy.entry("Long", strategy.long, when=ta.crossover(fast, slow))
`);
        expect(source).toContain("if (ta.crossover(fast, slow).current)");
    });

    it("lowers every arm of the subjectless switch", () => {
        const source = output(`//@version=5
strategy("S", overlay=true)
fast = ta.ema(close, 12)
slow = ta.ema(close, 26)
switch
    ta.crossover(fast, slow) => strategy.entry("Long", strategy.long)
    ta.crossunder(fast, slow) => strategy.close("Long")
`);
        expect(source).toContain("if (ta.crossover(fast, slow).current)");
        expect(source).toContain("else if (ta.crossunder(fast, slow).current)");
    });

    it("lowers a plotshape condition, parenthesised or not", () => {
        const source = output(`//@version=5
indicator("PS", overlay=true)
fast = ta.ema(close, 12)
slow = ta.ema(close, 26)
plotshape((ta.crossover(fast, slow)), title="Up", style=shape.triangleup)
plotshape(ta.crossunder(fast, slow), title="Dn", style=shape.triangledown)
`);
        expect(source).toContain("(ta.crossover(fast, slow).current) ?");
        expect(source).toContain("ta.crossunder(fast, slow).current ?");
    });

    it("leaves non-series booleans, comparisons and literals untouched", () => {
        const source = output(`//@version=5
indicator("Sc", overlay=true)
useIt = input.bool(true, "Use")
flag = close > open
if useIt
    plot(close)
if flag
    plot(open)
if close > open
    plot(high)
if true
    plot(low)
`);
        expect(predicatesOf(source)).toEqual([
            "(inputs.useIt as boolean)",
            "flag",
            "bar.close > bar.open",
            "true",
        ]);
        // No scalar position was turned into a member read.
        expect(source).not.toContain(".current");
    });

    it("does not double-project a compound predicate", () => {
        const source = output(`//@version=5
strategy("C", overlay=true)
fast = ta.ema(close, 12)
slow = ta.ema(close, 26)
if ta.crossover(fast, slow) and close > open
    strategy.entry("Long", strategy.long)
if not ta.crossunder(fast, slow)
    strategy.close("Long")
`);
        expect(source).toContain("if (ta.crossover(fast, slow).current && (bar.close > bar.open))");
        expect(source).toContain("if (!ta.crossunder(fast, slow).current)");
        expect(source).not.toContain(".current.current");
    });

    it("does not double-project a predicate that reads an already-lowered local", () => {
        const source = output(`//@version=5
strategy("A", overlay=true)
fast = ta.ema(close, 12)
slow = ta.ema(close, 26)
longCondition = ta.crossover(fast, slow)
if (longCondition)
    strategy.entry("Long", strategy.long)
`);
        // The declaration already lowers to the scalar; the predicate must read
        // the local as-is rather than append a second projection.
        expect(source).toContain("let longCondition = ta.crossover(fast, slow).current;");
        expect(source).toContain("if ((longCondition))");
        expect(source).not.toContain(".current.current");
        expect(source).not.toContain("longCondition.current");
    });
});
