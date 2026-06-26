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
import { transformOther } from "./other.js";

type ConvertibleDecl = Extract<
    Declaration,
    { kind: "indicator-declaration" | "strategy-declaration" }
>;

// Run the lex → parse → analyze → transform pipeline over an indicator body and
// return its compute-body source lines + the diagnostics raised.
function run(body: string): { statements: readonly string[]; codes: readonly string[] } {
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
    return {
        statements: scaffold.computeBody.statements,
        codes: diagnostics.toArray().map((d) => d.code),
    };
}

const stmts = (body: string): readonly string[] => run(body).statements;

describe("nested ta.* → .current lowering", () => {
    it("lowers a ta.* operand of a binary operator on either side", () => {
        expect(stmts("r = ta.rsi(close, 14) * 0.1")).toContain(
            "let r = ta.rsi(bar.close, 14).current * 0.1;",
        );
        expect(stmts("r = 0.1 * ta.rsi(close, 14)")).toContain(
            "let r = 0.1 * ta.rsi(bar.close, 14).current;",
        );
    });

    it("lowers a doubly-nested ta.* (inside a parenthesised sub-expression)", () => {
        expect(stmts("r = ta.rsi(close, 14) * (high + ta.sma(close, 20))")).toContain(
            "let r = ta.rsi(bar.close, 14).current * (bar.high + ta.sma(bar.close, 20).current);",
        );
    });

    it("lowers both arms (and the condition) of a ternary", () => {
        expect(stmts("s = close > open ? ta.ema(close, 8) : ta.sma(close, 8)")).toContain(
            "let s = (bar.close > bar.open) ? ta.ema(bar.close, 8).current : ta.sma(bar.close, 8).current;",
        );
    });

    it("lowers a ta.* operand of a unary operator", () => {
        expect(stmts("u = -ta.rsi(close, 14)")).toContain(
            "let u = -ta.rsi(bar.close, 14).current;",
        );
    });

    it("lowers a ta.* fed as a scalar math.* argument", () => {
        expect(stmts("m = math.max(ta.rsi(close, 14), 50)")).toContain(
            "let m = Math.max(ta.rsi(bar.close, 14).current, 50);",
        );
    });

    it("keeps a ta.* SOURCE arg to another ta.* a Series (no inner .current)", () => {
        // chartlang `ta.crossover(a: Series<number>, …)` takes Series sources, so
        // the inner `ta.sma` stays bare; only the outer call projects `.current`.
        expect(stmts("c = ta.crossover(close, ta.sma(close, 20))")).toContain(
            "let c = ta.crossover(bar.close, ta.sma(bar.close, 20)).current;",
        );
    });

    it("keeps a ta.* history-access receiver a Series", () => {
        expect(stmts("h = ta.sma(close, 20)[1]")).toContain("let h = ta.sma(bar.close, 20)[1];");
    });

    it("remaps a signature-divergent nested ta.* without raising its diagnostic", () => {
        const { statements, codes } = run("d = ta.rma(close, 14) + 1");
        expect(statements).toContain("let d = ta.smma(bar.close, 14).current + 1;");
        expect(codes).not.toContain("pine-converter/transform/ta-signature-divergence");
    });

    it("leaves an unmapped / REJECT nested ta.* bare (no crash, no .current)", () => {
        expect(stmts("k = ta.kcw(close, 20) * 2")).toContain("let k = ta.kcw(bar.close, 20) * 2;");
    });

    it("lowers a nested pivot ta.* through the ta.pivotsHighLow opts form", () => {
        expect(stmts("p = ta.pivothigh(5, 5) + 1")).toContain(
            "let p = ta.pivotsHighLow({ leftLength: 5, rightLength: 5 }).high.current + 1;",
        );
    });

    it("keeps a top-level single ta.* a single .current (no double)", () => {
        const [line] = stmts("t = ta.rsi(close, 14)");
        expect(line).toBe("let t = ta.rsi(bar.close, 14).current;");
        expect(line?.match(/\.current/g)).toHaveLength(1);
    });

    it("raises nested-ta-lowered ONCE per script (deduped across many sites)", () => {
        const { codes } = run(
            "a = ta.rsi(close, 14) * 0.1\nb = ta.ema(close, 8) + 1\nc = -ta.atr(14)",
        );
        expect(
            codes.filter((c) => c === "pine-converter/transform/nested-ta-lowered"),
        ).toHaveLength(1);
    });

    it("raises nested-ta-not-lowered for an unmapped ta.* in a scalar position", () => {
        const { codes } = run("k = ta.kcw(close, 20) * 2");
        expect(codes).toContain("pine-converter/transform/nested-ta-not-lowered");
    });

    it("raises no nested-ta diagnostic for a top-level ta.* (emitTa owns it)", () => {
        const { codes } = run("t = ta.rsi(close, 14)");
        expect(codes).not.toContain("pine-converter/transform/nested-ta-lowered");
        expect(codes).not.toContain("pine-converter/transform/nested-ta-not-lowered");
    });
});

describe("nested math.* → Math.* lowering", () => {
    it("lowers a nested bare-native math member to its Math.* passthrough", () => {
        // The OUTER `math.max` is the top-level value (emitMath → `Math.max`); the
        // INNER `math.min` is a nested call that, before this rule, leaked the
        // undefined `math.min` member. `rewriteTree` now rewrites the nested
        // callee to `Math.min`, mirroring the top-level simple case.
        expect(stmts("r = math.max(math.min(close, 100), 0)")).toContain(
            "let r = Math.max(Math.min(bar.close, 100), 0);",
        );
    });

    it("recurses into a nested math arg so a doubly-nested member also lowers", () => {
        expect(stmts("r = math.max(math.min(math.abs(close), 100), 0)")).toContain(
            "let r = Math.max(Math.min(Math.abs(bar.close), 100), 0);",
        );
    });

    it("leaves a nested chart-aware math.* member (math.avg) as-is", () => {
        // `math.avg` is a REAL chartlang `math` namespace member (not a bare
        // `Math.*`), so the nested rule does NOT rewrite it — its rolling-window
        // handling stays the top-level path's concern.
        expect(stmts("r = math.max(math.avg(close, open), 0)")).toContain(
            "let r = Math.max(math.avg(bar.close, bar.open), 0);",
        );
    });

    it("leaves a nested unmapped/REJECT math.* member untouched", () => {
        // `math.random` is a REJECT (`mathLookup` → null), so the nested rule
        // does not fire; the generic recursion re-emits the bare call.
        expect(stmts("r = math.max(math.random(), 0)")).toContain(
            "let r = Math.max(math.random(), 0);",
        );
    });
});
