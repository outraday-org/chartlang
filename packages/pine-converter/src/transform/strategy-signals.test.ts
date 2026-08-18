// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { CallExpression } from "../ast/index.js";
import { DIAGNOSTIC_CODE_ENTRIES } from "../diagnostics/codes.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import type { EmitContext } from "./emitContext.js";
import {
    emitStrategySignal,
    isStrategyDirectionExpr,
    isStrategySignalCall,
} from "./strategySignals.js";

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

// A minimal context: no inputs, no state slots — enough for the literal and
// bare-identifier expressions these cases emit. `other.test.ts` covers the
// input-rewrite path through the real `transformOther` context.
function ctx(inputNames: readonly string[] = []): EmitContext {
    return {
        annotations: new Map(),
        inputNames: new Set(inputNames),
        localNames: new Set<string>(),
        stateSlots: new Map<string, string>(),
    };
}

function emit(expr: string): { source: string | null; codes: string[]; messages: string[] } {
    const diagnostics = new DiagnosticCollector();
    const source = emitStrategySignal(call(expr), ctx(), diagnostics);
    const items = diagnostics.toArray();
    return {
        source,
        codes: items.map((d) => d.code),
        messages: items.map((d) => d.message),
    };
}

describe("isStrategySignalCall", () => {
    it("recognises every strategy order member and rejects others", () => {
        expect(isStrategySignalCall(call('strategy.entry("Long", strategy.long)'))).toBe(true);
        expect(isStrategySignalCall(call("strategy.exit()"))).toBe(true);
        expect(isStrategySignalCall(call("strategy.close_all()"))).toBe(true);
        expect(isStrategySignalCall(call("plot(close)"))).toBe(false);
        // `cancel` has no chartlang analogue (there is no resting order to
        // cancel), so it stays unrecognised rather than converting to a no-op.
        expect(isStrategySignalCall(call('strategy.cancel("x")'))).toBe(false);
    });
});

describe("isStrategyDirectionExpr", () => {
    it("recognises only the two bare direction constants", () => {
        const arg = (expr: string) => call(`strategy.entry("L", ${expr})`).args[1].value;
        expect(isStrategyDirectionExpr(arg("strategy.long"))).toBe(true);
        expect(isStrategyDirectionExpr(arg("strategy.short"))).toBe(true);
        expect(isStrategyDirectionExpr(arg("strategy.flat"))).toBe(false);
        expect(isStrategyDirectionExpr(arg("dir"))).toBe(false);
        expect(isStrategyDirectionExpr(arg("close"))).toBe(false);
    });
});

describe("emitStrategySignal", () => {
    it("returns null for a non-strategy-signal call", () => {
        expect(
            emitStrategySignal(call("plot(close)"), ctx(), new DiagnosticCollector()),
        ).toBeNull();
        expect(
            emitStrategySignal(call('strategy.cancel("x")'), ctx(), new DiagnosticCollector()),
        ).toBeNull();
    });

    it("lowers strategy.entry to order.buy / order.sell by direction", () => {
        const long = emit('strategy.entry("Long", strategy.long)');
        expect(long.source).toBe('order.buy({ label: "Long" });');
        expect(long.codes).toEqual(["pine-converter/transform/strategy-signal-only"]);
        expect(emit('strategy.entry("S", strategy.short)').source).toBe(
            'order.sell({ label: "S" });',
        );
    });

    it("resolves a NAMED direction argument the same way", () => {
        expect(emit('strategy.entry(id = "S", direction = strategy.short)').source).toBe(
            'order.sell({ label: "S" });',
        );
    });

    it("lowers strategy.order like strategy.entry, with a positional qty", () => {
        expect(emit('strategy.order("O", strategy.long, 4)').source).toBe(
            'order.buy({ label: "O", qty: 4 });',
        );
    });

    it("assumes order.buy and warns when the direction cannot be resolved", () => {
        const { source, codes } = emit('strategy.entry("E", dir)');
        expect(source).toBe('order.buy({ label: "E" });');
        expect(codes).toContain("pine-converter/transform/strategy-direction-assumed");
    });

    it("assumes order.buy and warns when the direction argument is absent", () => {
        const { source, codes } = emit('strategy.entry("E")');
        expect(source).toBe('order.buy({ label: "E" });');
        expect(codes).toContain("pine-converter/transform/strategy-direction-assumed");
    });

    it("lowers close / close_all to order.close", () => {
        expect(emit('strategy.close("Long")').source).toBe('order.close({ label: "Long" });');
        expect(emit("strategy.close_all()").source).toBe("order.close();");
    });

    it("carries a qty on a close (it rides the wire even though the tracker flattens)", () => {
        expect(emit('strategy.close("Long", qty = 2)').source).toBe(
            'order.close({ label: "Long", qty: 2 });',
        );
    });

    it("lowers exit to order.close and names every dropped bracket argument", () => {
        const { source, codes, messages } = emit(
            'strategy.exit("X", "Long", stop = 90, limit = 110)',
        );
        expect(source).toBe('order.close({ label: "X" });');
        expect(codes).toContain("pine-converter/transform/strategy-order-args-dropped");
        const dropped = messages.find((m) => m.includes("dropped")) ?? "";
        expect(dropped).toContain("`from_entry`");
        expect(dropped).toContain("`stop`");
        expect(dropped).toContain("`limit`");
        // The close targets FLAT — a partial exit is not reproduced.
        expect(dropped).toContain("targets flat");
    });

    it("reports a single dropped argument in the singular", () => {
        const { messages } = emit('strategy.entry("L", strategy.long, limit = 100)');
        expect(messages.find((m) => m.includes("dropped"))).toContain("`limit` was dropped");
    });

    it("names an unrecognised positional argument by its index", () => {
        // Past the end of the member's parameter table (close_all takes at most
        // three), a positional falls back to `#<n>`.
        const { messages } = emit("strategy.close_all(1, 2, 3, 4)");
        expect(messages.find((m) => m.includes("dropped"))).toContain("`#4`");
    });

    it("preserves a `when =` condition as the enclosing if, never dropping it", () => {
        expect(emit('strategy.close("Long", when = close > open)').source).toBe(
            'if (bar.close > bar.open) { order.close({ label: "Long" }); }',
        );
        // `close`'s second POSITIONAL slot is `when` too.
        expect(emit('strategy.close("Long", close > open)').source).toBe(
            'if (bar.close > bar.open) { order.close({ label: "Long" }); }',
        );
    });

    it("omits a non-literal order id and says so", () => {
        const { source, messages } = emit("strategy.entry(idVar, strategy.long)");
        expect(source).toBe("order.buy();");
        expect(messages[0]).toContain("not a string literal");
    });

    it("omits a qty that is not an inline scalar and says so", () => {
        // `strategy.short` is the misplaced-direction case: the semantic pass
        // skips direction constants ANYWHERE in a signal call, so one landing
        // in the qty slot arrives here unresolved and must not be emitted
        // verbatim into `qty:`.
        for (const arg of ["na", '"two"', "true", "[1, 2]", "strategy.short"]) {
            const { source, messages } = emit(`strategy.entry("L", strategy.long, ${arg})`);
            expect(source).toBe('order.buy({ label: "L" });');
            expect(messages.some((m) => m.includes("not an inline scalar"))).toBe(true);
        }
    });

    it("passes a computed scalar qty through", () => {
        expect(emit('strategy.entry("L", strategy.long, 2 * 3)').source).toBe(
            'order.buy({ label: "L", qty: 2 * 3 });',
        );
    });

    it("keeps the per-call override in lockstep with the registry message", () => {
        const { messages } = emit("strategy.entry(idVar, strategy.long)");
        expect(messages[0]).toContain(
            DIAGNOSTIC_CODE_ENTRIES["strategy-signal-only"].defaultMessage,
        );
    });
});
