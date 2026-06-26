// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { CallExpression } from "../ast/index.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import type { EmitContext } from "./emitContext.js";
import { emitPlotFamily, isPlotFamilyCall } from "./plotFamily.js";

const CTX: EmitContext = {
    annotations: new Map(),
    inputNames: new Set(),
    localNames: new Set(),
    stateSlots: new Map(),
};

// Parse a bare call statement (`plot(close)`) into its CallExpression.
function call(expr: string): CallExpression {
    const src = `//@version=6\nindicator("X")\n${expr}\n`;
    const script = parseStatements(lex(src).tokens).script;
    for (const stmt of script.body) {
        if (stmt.kind === "expression-statement" && stmt.expression.kind === "call-expression") {
            return stmt.expression;
        }
    }
    throw new Error("no call expression in fixture");
}

function emit(expr: string): { source: string | null; codes: string[] } {
    const diagnostics = new DiagnosticCollector();
    const source = emitPlotFamily(call(expr), CTX, diagnostics);
    return { source, codes: diagnostics.toArray().map((d) => d.code) };
}

describe("isPlotFamilyCall", () => {
    it("recognises plot-family bare calls and rejects others", () => {
        expect(isPlotFamilyCall(call("plot(close)"))).toBe(true);
        expect(isPlotFamilyCall(call("hline(0)"))).toBe(true);
        expect(isPlotFamilyCall(call("ta.ema(close, 9)"))).toBe(false);
    });
});

describe("emitPlotFamily", () => {
    it("returns null for a non-plot-family call", () => {
        expect(emit("foo(close)").source).toBeNull();
    });

    it("lowers plot with title/color/linewidth options", () => {
        expect(emit('plot(close, "Close", color.red, 2)').source).toBe(
            'plot(bar.close, { title: "Close", color: "#FF5252", lineWidth: 2 });',
        );
    });

    it("lowers a bare plot with no options", () => {
        expect(emit("plot(close)").source).toBe("plot(bar.close);");
    });

    it("passes a non-enum color through the expression emitter", () => {
        expect(emit("plot(close, color=myColor)").source).toBe(
            "plot(bar.close, { color: myColor });",
        );
    });

    it("returns null for plot with no value", () => {
        expect(emit("plot()").source).toBeNull();
    });

    it("lowers plotshape to a valid shape style with the glyph + size", () => {
        // `color` moves to plot level (the `shape` style carries no color);
        // a missing `style=` glyph defaults to `circle`.
        expect(emit("plotshape(close > open, color=color.green)").source).toBe(
            'plot(bar.close > bar.open ? bar.close : Number.NaN, { color: "#4CAF50", style: { kind: "shape", shape: "circle", size: 8 } });',
        );
        // An explicit `style=shape.*` glyph maps through `enumLookup`.
        expect(emit("plotshape(close > open, style=shape.triangleup)").source).toBe(
            'plot(bar.close > bar.open ? bar.close : Number.NaN, { style: { kind: "shape", shape: "triangle-up", size: 8 } });',
        );
    });

    it("lowers plotchar with a char option", () => {
        expect(emit('plotchar(close > open, char="X")').source).toBe(
            'plot(bar.close > bar.open ? bar.close : Number.NaN, { style: { kind: "character", char: "X", size: 12 } });',
        );
    });

    it("lowers plotarrow", () => {
        expect(emit("plotarrow(close)").source).toBe(
            'plot(bar.close ? bar.close : Number.NaN, { style: { kind: "arrow", direction: "up", size: 10 } });',
        );
    });

    it("defaults the glyph to circle for an unmapped `style=` enum", () => {
        expect(emit("plotshape(close > open, style=shape.bogus)").source).toBe(
            'plot(bar.close > bar.open ? bar.close : Number.NaN, { style: { kind: "shape", shape: "circle", size: 8 } });',
        );
    });

    it("threads a mapped `location=` into the style", () => {
        expect(emit("plotshape(close > open, location=location.abovebar)").source).toBe(
            'plot(bar.close > bar.open ? bar.close : Number.NaN, { style: { kind: "shape", shape: "circle", size: 8, location: "above" } });',
        );
    });

    it("defaults plotchar to a bullet when no char is given", () => {
        expect(emit("plotchar(close > open)").source).toBe(
            'plot(bar.close > bar.open ? bar.close : Number.NaN, { style: { kind: "character", char: "•", size: 12 } });',
        );
    });

    it("projects `.current` on a `ta.*` boolean condition", () => {
        // A `ta.*` call returns a `Series<boolean>`; without `.current` the
        // object is always truthy and the shape would plot on every bar.
        expect(emit("plotshape(ta.crossover(close, open))").source).toBe(
            'plot(ta.crossover(bar.close, bar.open).current ? bar.close : Number.NaN, { style: { kind: "shape", shape: "circle", size: 8 } });',
        );
    });

    it("leaves a non-`ta` call condition unprojected", () => {
        // A user-defined call has no scalar-projecting `.current`; emit it as-is.
        expect(emit("plotshape(myCond())").source).toBe(
            'plot(myCond() ? bar.close : Number.NaN, { style: { kind: "shape", shape: "circle", size: 8 } });',
        );
    });

    it("returns null for a conditional with no condition", () => {
        expect(emit("plotshape()").source).toBeNull();
    });

    it("lowers plotcandle", () => {
        expect(emit("plotcandle(open, high, low, close)").source).toBe(
            'plot(bar.close, { style: { kind: "candle-override" } });',
        );
    });

    it("returns null for plotcandle missing a series", () => {
        expect(emit("plotcandle(open, high, low)").source).toBeNull();
    });

    it("lowers plotbar with a color", () => {
        expect(emit("plotbar(open, high, low, close, color=color.red)").source).toBe(
            'plot(Number.NaN, { style: { kind: "bar-override", color: "#FF5252" } });',
        );
    });

    it("lowers plotbar with no color", () => {
        expect(emit("plotbar(open, high, low, close)").source).toBe(
            'plot(Number.NaN, { style: { kind: "bar-override" } });',
        );
    });

    it("lowers hline with options and bare", () => {
        expect(emit('hline(0, "Zero", color.gray)').source).toBe(
            'hline(0, { title: "Zero", color: "#787B86" });',
        );
        expect(emit("hline(50)").source).toBe("hline(50);");
    });

    it("returns null for hline with no price", () => {
        expect(emit("hline()").source).toBeNull();
    });

    it("lowers bgcolor and barcolor to the Pine-ergonomic sugar aliases", () => {
        expect(emit("bgcolor(color.red)").source).toBe('bgcolor("#FF5252");');
        expect(emit("barcolor(color.green)").source).toBe('barcolor("#4CAF50");');
    });

    it("carries a per-bar conditional color through bgcolor unchanged", () => {
        expect(emit("bgcolor(close > open ? color.green : color.red)").source).toBe(
            'bgcolor(bar.close > bar.open ? "#4CAF50" : "#FF5252");',
        );
        expect(emit("barcolor(close > open ? color.green : color.red)").source).toBe(
            'barcolor(bar.close > bar.open ? "#4CAF50" : "#FF5252");',
        );
    });

    it("resolves color enum leaves through paren grouping", () => {
        expect(emit("bgcolor((color.red))").source).toBe('bgcolor(("#FF5252"));');
    });

    it("threads bgcolor transp and title onto the opts bag", () => {
        expect(emit("bgcolor(color.red, 80)").source).toBe('bgcolor("#FF5252", { transp: 80 });');
        expect(emit('bgcolor(color.red, title = "Heat")').source).toBe(
            'bgcolor("#FF5252", { title: "Heat" });',
        );
        expect(emit('barcolor(color.green, title = "Tint")').source).toBe(
            'barcolor("#4CAF50", { title: "Tint" });',
        );
    });

    it("returns null for bgcolor/barcolor with no color", () => {
        expect(emit("bgcolor()").source).toBeNull();
        expect(emit("barcolor()").source).toBeNull();
    });

    it("rejects fill with fill-not-mapped", () => {
        const { source, codes } = emit("fill(p1, p2, color.red)");
        expect(source).toBeNull();
        expect(codes).toContain("pine-converter/transform/fill-not-mapped");
    });

    it("threads a positive plot offset onto a direct `ta.*` plot value", () => {
        const { source, codes } = emit("plot(ta.sma(close, 20), offset=5)");
        expect(source).toBe("plot(ta.sma(bar.close, 20, { offset: 5 }));");
        expect(codes).toEqual([]);
    });

    it("threads a negative plot offset onto a direct `ta.*` plot value", () => {
        const { source, codes } = emit("plot(ta.sma(close, 20), offset=-5)");
        expect(source).toBe("plot(ta.sma(bar.close, 20, { offset: -5 }));");
        expect(codes).toEqual([]);
    });

    it("threads a non-literal plot offset verbatim onto a `ta.*` value", () => {
        // `offset` accepts a non-literal in chartlang; emit the expression as-is.
        const { source, codes } = emit("plot(ta.ema(close, 9), offset=shift)");
        expect(source).toBe("plot(ta.ema(bar.close, 9, { offset: shift }));");
        expect(codes).toEqual([]);
    });

    it("merges the plot offset alongside the `ta.*` call's own named args", () => {
        // The ta call's non-`offset` named args fold into the same opts object.
        const { source } = emit("plot(ta.atr(length=14), offset=3)");
        expect(source).toBe("plot(ta.atr({ length: 14, offset: 3 }));");
    });

    it("keeps the title/color plot options alongside the threaded offset", () => {
        const { source } = emit("plot(ta.sma(close, 20), color=color.red, offset=2)");
        expect(source).toBe('plot(ta.sma(bar.close, 20, { offset: 2 }), { color: "#FF5252" });');
    });

    it("treats `offset=0` as no offset (byte-identical to the no-offset path)", () => {
        const { source, codes } = emit("plot(ta.sma(close, 20), offset=0)");
        expect(source).toBe("plot(ta.sma(bar.close, 20));");
        expect(codes).toEqual([]);
    });

    it("treats a float `offset=0.0` as no offset too", () => {
        const { source, codes } = emit("plot(ta.sma(close, 20), offset=0.0)");
        expect(source).toBe("plot(ta.sma(bar.close, 20));");
        expect(codes).toEqual([]);
    });

    it("overrides a `ta.*` call's own `offset=` with the plot-level offset", () => {
        const { source, codes } = emit("plot(ta.sma(close, 20, offset=3), offset=5)");
        expect(source).toBe("plot(ta.sma(bar.close, 20, { offset: 5 }));");
        expect(codes).toContain("pine-converter/transform/plot-offset-overrides-ta-offset");
    });

    it("drops a plot offset on a non-`ta.*` value with plot-offset-needs-ta-call", () => {
        const { source, codes } = emit("plot(close, offset=5)");
        expect(source).toBe("plot(bar.close);");
        expect(codes).toContain("pine-converter/transform/plot-offset-needs-ta-call");
    });

    it("drops a plot offset on an arithmetic plot value", () => {
        const { source, codes } = emit("plot(close + 1, offset=5)");
        expect(source).toBe("plot(bar.close + 1);");
        expect(codes).toContain("pine-converter/transform/plot-offset-needs-ta-call");
    });

    it("drops a plot offset on a non-`ta.*` call value (bare-identifier callee)", () => {
        // `dottedCallee` is null for a plain `myFunc()` callee, so the offset
        // cannot thread onto a chartlang `ta.*` opts and is dropped.
        const { source, codes } = emit("plot(myFunc(), offset=5)");
        expect(source).toBe("plot(myFunc());");
        expect(codes).toContain("pine-converter/transform/plot-offset-needs-ta-call");
    });
});

describe("emitPlotFamily — color transparency", () => {
    const APPROX = "pine-converter/transform/color-transp-approximated";

    it("folds a 4-arg color.rgb plot colour to a #RRGGBBAA hex", () => {
        const { source, codes } = emit("plot(close, color=color.rgb(255, 153, 0, 60))");
        expect(source).toBe('plot(bar.close, { color: "#FF990066" });');
        expect(codes).toContain(APPROX);
    });

    it("folds a literal-base color.new plot colour to a #RRGGBBAA hex", () => {
        const { source, codes } = emit("plot(close, color=color.new(color.red, 50))");
        expect(source).toBe('plot(bar.close, { color: "#FF525280" });');
        expect(codes).toContain(APPROX);
    });

    it("lowers a dynamic-base color.new bgcolor to color.withAlpha", () => {
        const { source, codes } = emit("bgcolor(color.new(myColor, 80))");
        expect(source).toBe("bgcolor(color.withAlpha(myColor, 0.2));");
        expect(codes).toContain(APPROX);
    });

    it("folds a color.new hline colour to a #RRGGBBAA hex", () => {
        const { source, codes } = emit("hline(0, color=color.new(color.gray, 80))");
        expect(source).toBe('hline(0, { color: "#787B8633" });');
        expect(codes).toContain(APPROX);
    });

    it("folds a color.new plotshape plot-level colour", () => {
        const { source, codes } = emit("plotshape(close > open, color=color.new(color.green, 0))");
        expect(source).toBe(
            "plot(bar.close > bar.open ? bar.close : Number.NaN, " +
                '{ color: "#4CAF50FF", style: { kind: "shape", shape: "circle", size: 8 } });',
        );
        expect(codes).toContain(APPROX);
    });

    it("folds a color.new plotbar colour", () => {
        const { source, codes } = emit(
            "plotbar(open, high, low, close, color=color.new(color.red, 80))",
        );
        expect(source).toBe(
            'plot(Number.NaN, { style: { kind: "bar-override", color: "#FF525233" } });',
        );
        expect(codes).toContain(APPROX);
    });

    it("does not raise the approximation note for a plain colour enum", () => {
        const { source, codes } = emit("plot(close, color=color.red)");
        expect(source).toBe('plot(bar.close, { color: "#FF5252" });');
        expect(codes).not.toContain(APPROX);
    });
});
