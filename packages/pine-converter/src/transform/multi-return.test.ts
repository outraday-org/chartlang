// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { convert } from "../index.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";

// Convert a body and return the compute statements + diagnostic codes.
function run(body: string): { lines: string[]; codes: string[] } {
    const src = `//@version=6\nindicator("X")\n${body}\n`;
    const result = convert(src, { barInterval: 60_000, barIndexOrigin: 1_700_000_000_000 });
    const lines = (result.output ?? "").split("\n").map((line) => line.trim());
    return { lines, codes: result.diagnostics.map((d) => d.code) };
}

const parseCodes = (body: string): string[] => {
    const src = `//@version=6\nindicator("X")\n${body}\n`;
    return parseStatements(lex(src).tokens).diagnostics.map((d) => d.code);
};

describe("tuple destructuring — parser head guard", () => {
    it("parses a well-formed multi-name destructuring", () => {
        const stmts = parseStatements(
            lex('//@version=6\nindicator("X")\n[a, b, c] = ta.macd(close)\n').tokens,
        ).script.body;
        expect(stmts[0]?.kind).toBe("tuple-declaration");
    });

    it("rejects a non-identifier first target", () => {
        expect(parseCodes("[1, b] = ta.macd(close)")).toContain(
            "pine-converter/parse/unexpected-token",
        );
    });

    it("rejects a non-identifier after a comma", () => {
        expect(parseCodes("[a, 1] = ta.macd(close)")).toContain(
            "pine-converter/parse/unexpected-token",
        );
    });

    it("rejects a missing comma between targets", () => {
        expect(parseCodes("[a b] = ta.macd(close)")).toContain(
            "pine-converter/parse/unexpected-token",
        );
    });

    it("rejects a `:=` (not a fresh declaration)", () => {
        expect(parseCodes("[a, b] := ta.macd(close)")).toContain(
            "pine-converter/parse/unexpected-token",
        );
    });
});

describe("tuple destructuring — lowering", () => {
    it("lowers ta.macd into a result const + .current field aliases", () => {
        const { lines, codes } = run(
            "[m, s, h] = ta.macd(close, 12, 26, 9)\nplot(m)\nplot(s)\nplot(h)",
        );
        expect(codes).toEqual([]);
        expect(lines).toContain(
            "const mResult = ta.macd(bar.close, { fastLength: 12, slowLength: 26, signalLength: 9 });",
        );
        expect(lines).toContain("plot(mResult.macd.current);");
        expect(lines).toContain("plot(mResult.signal.current);");
        expect(lines).toContain("plot(mResult.hist.current);");
    });

    it("rewrites aliases inside arithmetic", () => {
        const { lines } = run("[m, s, h] = ta.macd(close)\nx = m - s\nplot(x)");
        expect(lines).toContain("let x = mResult.macd.current - mResult.signal.current;");
    });

    it("uses chartlang defaults when Pine omits optional args", () => {
        const { lines } = run("[m, s, h] = ta.macd(close)\nplot(m)");
        expect(lines).toContain("const mResult = ta.macd(bar.close);");
    });

    it("skips `_` placeholder targets", () => {
        const { lines, codes } = run("[m, _, h] = ta.macd(close)\nplot(m)\nplot(h)");
        expect(codes).toEqual([]);
        expect(lines).toContain("plot(mResult.macd.current);");
        expect(lines).toContain("plot(mResult.hist.current);");
        // The `_` element is never aliased.
        expect(lines.some((l) => l.includes("signal"))).toBe(false);
    });

    it("names the result `anonResult` when every target is `_`", () => {
        const { lines } = run("[_, _, _] = ta.macd(close)");
        expect(lines).toContain("const anonResult = ta.macd(bar.close);");
    });

    it("warns multi-return-not-mapped for a non-multi-return RHS", () => {
        const { lines, codes } = run("[a, b] = ta.sma(close, 9)\nplot(a)");
        expect(codes).toContain("pine-converter/transform/multi-return-not-mapped");
        expect(lines.some((l) => l.includes("_result"))).toBe(false);
    });

    it("infers the element qualifier from a user-variable RHS source", () => {
        // The RHS references a declared `src`, exercising the qualifier
        // resolver inside the tuple-declaration semantic walk.
        const { lines, codes } = run("src = close\n[m, s, h] = ta.macd(src)\nplot(m)");
        expect(codes).toEqual([]);
        expect(lines).toContain("const mResult = ta.macd(src);");
    });

    it("warns multi-return-not-mapped for a non-call RHS", () => {
        const { codes } = run("[a, b] = close\nplot(a)");
        expect(codes).toContain("pine-converter/transform/multi-return-not-mapped");
    });

    it("warns multi-return-not-mapped for a computed (non-dotted) callee", () => {
        const { codes } = run("[a, b] = na(close)\nplot(a)");
        expect(codes).toContain("pine-converter/transform/multi-return-not-mapped");
    });

    it("warns multi-return-arity-mismatch + drops the args for ta.dmi's ADX", () => {
        const { lines, codes } = run(
            "[plus, minus, adx] = ta.dmi(14, 14)\nplot(plus)\nplot(minus)",
        );
        expect(codes).toContain("pine-converter/transform/multi-return-arity-mismatch");
        expect(codes).toContain("pine-converter/transform/multi-return-arg-dropped");
        expect(lines).toContain("const plusResult = ta.dmi(14);");
        expect(lines).toContain("plot(plusResult.plusDi.current);");
        expect(lines).toContain("plot(plusResult.minusDi.current);");
    });
});
