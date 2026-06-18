// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";
import { describe, expect, it } from "vitest";

import type { CompileDiagnostic } from "../diagnostics.js";
import { createProgramForSource } from "../program.js";
import { validateSecurityExpr } from "./validateSecurityExpr.js";

/**
 * Wrap a `request.security(opts, <callback>)` expression in a realistic
 * `defineIndicator` so the destructured `compute({ ta, inputs })` bindings
 * resolve to core — exactly the scope the capture check runs in. The
 * `<callback>` text is the second argument source.
 */
function run(callbackSource: string): ReadonlyArray<CompileDiagnostic> {
    const source = `
import { defineIndicator, input, request } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    inputs: { len: input.int(20) },
    compute: ({ ta, inputs, plot }) => {
        const trend = request.security({ interval: "1W" }, ${callbackSource});
        plot(trend);
    },
});
`;
    const { sourceFile, checker } = createProgramForSource(source, {
        sourcePath: "demo.chart.ts",
    });
    const callback = findSecurityCallback(sourceFile);
    const diagnostics: CompileDiagnostic[] = [];
    validateSecurityExpr(callback, checker, diagnostics, "demo.chart.ts");
    return diagnostics;
}

function findSecurityCallback(sourceFile: ts.SourceFile): ts.ArrowFunction | ts.FunctionExpression {
    let found: ts.ArrowFunction | ts.FunctionExpression | undefined;
    const visit = (node: ts.Node): void => {
        if (found !== undefined) return;
        if (
            ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            node.expression.name.text === "security"
        ) {
            const arg = node.arguments[1];
            if (arg !== undefined && (ts.isArrowFunction(arg) || ts.isFunctionExpression(arg))) {
                found = arg;
                return;
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    if (found === undefined) throw new Error("no security callback found");
    return found;
}

describe("validateSecurityExpr", () => {
    it("accepts a ta call on the bar series", () => {
        expect(run("(bar) => ta.ema(bar.close, 20)")).toEqual([]);
    });

    it("accepts inputs reads and a derived bar field", () => {
        expect(run("(bar) => ta.rsi(bar.hlc3, inputs.len)")).toEqual([]);
    });

    it("accepts a plain bar series read", () => {
        expect(run("(bar) => bar.close.current")).toEqual([]);
    });

    it("accepts safe Math.* on a bar read", () => {
        expect(run("(bar) => Math.abs(bar.close.current)")).toEqual([]);
    });

    it("accepts a body local whose initialiser stays in subset", () => {
        expect(run("(bar) => { const c = bar.close; return ta.ema(c, 20); }")).toEqual([]);
    });

    it("accepts an opts object literal (property keys are not captures)", () => {
        expect(run("(bar) => ta.ema(bar.close, 20, { offset: 1 })")).toEqual([]);
    });

    it("accepts a shorthand property in an opts object", () => {
        expect(
            run("(bar) => { const offset = 1; return ta.ema(bar.close, 20, { offset }); }"),
        ).toEqual([]);
    });

    it("accepts an object-destructured bar binding", () => {
        expect(run("(bar) => { const { close: c } = bar; return ta.ema(c, 20); }")).toEqual([]);
    });

    it("accepts an array-destructured local binding", () => {
        expect(run("(bar) => { const [c] = [bar.close]; return ta.ema(c, 20); }")).toEqual([]);
    });

    it("rejects a captured scalar local", () => {
        const diagnostics = run("(bar) => ta.ema(bar.close, k)");
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0]?.code).toBe("request-security-expr-captures-local");
        expect(diagnostics[0]?.message).toContain("`k`");
    });

    it("rejects a captured outer series", () => {
        const diagnostics = run("(bar) => ta.ema(otherSeries, 20)");
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0]?.code).toBe("request-security-expr-captures-local");
        expect(diagnostics[0]?.message).toContain("`otherSeries`");
    });

    it("rejects a nested arrow", () => {
        const diagnostics = run("(bar) => [bar.close].map((s) => ta.ema(s, 20))");
        expect(diagnostics.some((d) => d.code === "request-security-expr-captures-local")).toBe(
            true,
        );
    });

    it("rejects a captured local even inside a body local initialiser", () => {
        const diagnostics = run("(bar) => { const c = k; return ta.ema(bar.close, c); }");
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0]?.message).toContain("`k`");
    });

    it("rejects an outer capture smuggled through a shorthand opts property", () => {
        const diagnostics = run("(bar) => ta.ema(bar.close, 20, { offset })");
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0]?.code).toBe("request-security-expr-captures-local");
        expect(diagnostics[0]?.message).toContain("`offset`");
    });

    it("rejects an outer capture in a parameter default", () => {
        const diagnostics = run("(bar = otherSeries) => bar.close.current");
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0]?.code).toBe("request-security-expr-captures-local");
        expect(diagnostics[0]?.message).toContain("`otherSeries`");
    });

    it("rejects `this` in a function-expression callback", () => {
        const diagnostics = run("function (bar) { return ta.ema(this.close, 20); }");
        expect(diagnostics.some((d) => d.code === "request-security-expr-captures-local")).toBe(
            true,
        );
    });

    it("accepts the safe value globals NaN, undefined and Infinity", () => {
        expect(run("(bar) => bar.close.current ?? NaN")).toEqual([]);
        expect(run("(bar) => (bar.close.current > 0 ? bar.close.current : undefined)")).toEqual([]);
        expect(run("(bar) => Math.min(bar.close.current, Infinity)")).toEqual([]);
    });
});
