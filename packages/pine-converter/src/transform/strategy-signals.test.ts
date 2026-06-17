// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { CallExpression } from "../ast/index.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import { emitStrategySignal, isStrategySignalCall } from "./strategySignals.js";

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
    const source = emitStrategySignal(call(expr), diagnostics);
    return { source, codes: diagnostics.toArray().map((d) => d.code) };
}

describe("isStrategySignalCall", () => {
    it("recognises strategy order members and rejects others", () => {
        expect(isStrategySignalCall(call('strategy.entry("Long", strategy.long)'))).toBe(true);
        expect(isStrategySignalCall(call("strategy.exit()"))).toBe(true);
        expect(isStrategySignalCall(call("plot(close)"))).toBe(false);
        expect(isStrategySignalCall(call('strategy.cancel("x")'))).toBe(false);
    });
});

describe("emitStrategySignal", () => {
    it("returns null for a non-strategy-signal call", () => {
        expect(emit("plot(close)").source).toBeNull();
    });

    it("lowers strategy.entry to an alert with the order id", () => {
        const { source, codes } = emit('strategy.entry("Long", strategy.long)');
        expect(source).toBe('alert("Long entry", { severity: "info" });');
        expect(codes).toContain("pine-converter/transform/strategy-signal-only");
    });

    it("lowers strategy.exit / close / order", () => {
        expect(emit('strategy.exit("X")').source).toBe('alert("X exit", { severity: "info" });');
        expect(emit('strategy.close("Long")').source).toBe(
            'alert("Long close", { severity: "info" });',
        );
        expect(emit('strategy.order("O")').source).toBe('alert("O order", { severity: "info" });');
    });

    it("uses the member name alone when no id literal is present", () => {
        expect(emit("strategy.close_all()").source).toBeNull();
        expect(emit("strategy.entry(idVar, strategy.long)").source).toBe(
            'alert("entry", { severity: "info" });',
        );
    });

    it("uses the member name alone when there is no positional argument", () => {
        expect(emit("strategy.entry(direction=strategy.long)").source).toBe(
            'alert("entry", { severity: "info" });',
        );
    });
});
