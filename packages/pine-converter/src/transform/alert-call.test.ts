// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { CallExpression } from "../ast/index.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { emitAlertCall, isAlertCall } from "./alertCall.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import type { EmitContext } from "./emitContext.js";

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

function ctx(): EmitContext {
    return {
        annotations: new Map(),
        inputNames: new Set(),
        localNames: new Set(),
        stateSlots: new Map(),
    };
}

function emit(expr: string): { source: string | null; codes: string[] } {
    const diagnostics = new DiagnosticCollector();
    const source = emitAlertCall(call(expr), ctx(), diagnostics);
    return { source, codes: diagnostics.toArray().map((d) => d.code) };
}

describe("isAlertCall", () => {
    it("recognises a bare alert call and rejects others", () => {
        expect(isAlertCall(call('alert("hi")'))).toBe(true);
        expect(isAlertCall(call("plot(close)"))).toBe(false);
        expect(isAlertCall(call('strategy.entry("Long", strategy.long)'))).toBe(false);
    });
});

describe("emitAlertCall", () => {
    it("returns null for a non-alert call", () => {
        expect(emitAlertCall(call("plot(close)"), ctx(), new DiagnosticCollector())).toBeNull();
    });

    it("returns null for an alert with no positional message", () => {
        expect(emit("alert()").source).toBeNull();
        expect(emit('alert(message="hi")').source).toBeNull();
    });

    it("passes a single message through with no diagnostic", () => {
        const { source, codes } = emit('alert("hi")');
        expect(source).toBe('alert("hi");');
        expect(codes).toEqual([]);
    });

    it("preserves a string-concat message", () => {
        expect(emit('alert("a" + "b", alert.freq_all)').source).toBe('alert("a" + "b");');
    });

    it("drops each recognised alert.freq_* enum with an info", () => {
        for (const freq of [
            "alert.freq_all",
            "alert.freq_once_per_bar",
            "alert.freq_once_per_bar_close",
        ]) {
            const { source, codes } = emit(`alert("hi", ${freq})`);
            expect(source).toBe('alert("hi");');
            expect(codes).toEqual(["pine-converter/transform/alert-frequency-not-mapped"]);
        }
    });

    it("drops an unrecognised second arg without an info", () => {
        // A non-member-access arg (identifier), a non-`alert`-rooted enum, a
        // wrong-length chain, an unknown alert member, and a computed-head
        // member each fail `isAlertFrequencyEnum` and emit message-only.
        for (const second of ["someFreq", "color.red", "alert.freq_all.x", "alert.freq_bogus"]) {
            const { source, codes } = emit(`alert("hi", ${second})`);
            expect(source).toBe('alert("hi");');
            expect(codes).toEqual([]);
        }
        const computedHead = emit('alert("hi", a[1].freq_all)');
        expect(computedHead.source).toBe('alert("hi");');
        expect(computedHead.codes).toEqual([]);
    });
});
