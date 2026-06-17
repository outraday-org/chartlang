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

    it("lowers plotshape to a conditional shape style", () => {
        expect(emit("plotshape(close > open, color=color.green)").source).toBe(
            'plot(bar.close > bar.open ? bar.close : Number.NaN, { style: { kind: "shape", color: "#4CAF50" } });',
        );
    });

    it("lowers plotchar with a char option", () => {
        expect(emit('plotchar(close > open, char="X")').source).toBe(
            'plot(bar.close > bar.open ? bar.close : Number.NaN, { style: { kind: "character", char: "X" } });',
        );
    });

    it("lowers plotarrow", () => {
        expect(emit("plotarrow(close)").source).toBe(
            'plot(bar.close ? bar.close : Number.NaN, { style: { kind: "arrow" } });',
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

    it("lowers bgcolor and barcolor to background styles", () => {
        expect(emit("bgcolor(color.red)").source).toBe(
            'plot(Number.NaN, { style: { kind: "bg-color", color: "#FF5252" } });',
        );
        expect(emit("barcolor(color.green)").source).toBe(
            'plot(Number.NaN, { style: { kind: "bar-color", color: "#4CAF50" } });',
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
});
