// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { convert } from "../index.js";

// Convert a body and return the trimmed compute statements + diagnostic codes,
// mirroring the multi-return.test.ts harness so the tuple-`request.security`
// lowering is asserted end-to-end through the real pipeline.
function run(body: string): { lines: string[]; codes: string[] } {
    const src = `//@version=6\nindicator("X")\n${body}\n`;
    const result = convert(src, { barInterval: 60_000, barIndexOrigin: 1_700_000_000_000 });
    const lines = (result.output ?? "").split("\n").map((line) => line.trim());
    return { lines, codes: result.diagnostics.map((d) => d.code) };
}

describe("tuple request.security — N-read lowering", () => {
    it("lowers OHLCV elements to data-form reads sharing one feed", () => {
        const { lines, codes } = run(
            '[hi, lo] = request.security(syminfo.tickerid, "D", [high, low])\nplot(hi)\nplot(lo)',
        );
        expect(codes).toEqual([]);
        expect(lines).toContain('const hi = request.security({ interval: "1d" }).high.current;');
        expect(lines).toContain('const lo = request.security({ interval: "1d" }).low.current;');
    });

    it("lowers a computed element to the callback form", () => {
        const { lines } = run(
            '[hi, trend] = request.security(syminfo.tickerid, "W", [high, ta.sma(close, 20)])\nplot(hi)\nplot(trend)',
        );
        expect(lines).toContain(
            'const trend = request.security({ interval: "1w" }, (bar) => ta.sma(bar.close.current, 20)).current;',
        );
    });

    it("lowers computed elements to block + expression callbacks when a stateful UDF exists", () => {
        const { lines } = run(
            "cf_pct(len) =>\n    a = ta.atr(len)\n    a / close * 100\n" +
                '[hi, pct, ma] = request.security(syminfo.tickerid, "D", [high, cf_pct(14), ta.sma(close, 20)])\n' +
                "plot(hi)\nplot(pct)\nplot(ma)",
        );
        // A multi-statement inlined UDF prelude → the block-bodied arrow form
        // (`(bar) => { let … ; return …; }`), projected `.current` like every read.
        const block = lines.find((l) => l.startsWith("const pct ="));
        expect(block).toMatch(/\(bar\) => \{ .*ta\.atr\(14\)\.current.* return .* \}\)\.current;$/);
        // A prelude-free source (a direct `ta.*`) stays the expression-arrow form
        // even though the script has a stateful UDF (statefulUdfs > 0, empty prelude).
        expect(lines).toContain(
            'const ma = request.security({ interval: "1d" }, (bar) => ta.sma(bar.close.current, 20)).current;',
        );
    });

    it("carries a literal symbol into the shared opts + one different-symbol info", () => {
        const { lines, codes } = run(
            '[hi, lo] = request.security("NASDAQ:QQQ", "D", [high, low])\nplot(hi)\nplot(lo)',
        );
        expect(codes).toEqual(["pine-converter/transform/request-security-different-symbol"]);
        expect(lines).toContain(
            'const hi = request.security({ symbol: "NASDAQ:QQQ", interval: "1d" }).high.current;',
        );
    });

    it("resolves an input-bound symbol + timeframe feed to inputs.<name> refs", () => {
        const { lines, codes } = run(
            [
                'sym = input.symbol("NASDAQ:QQQ")',
                'tf = input.timeframe("D")',
                "[hi, lo] = request.security(sym, tf, [high, low])",
                "plot(hi)",
                "plot(lo)",
            ].join("\n"),
        );
        expect(codes).toContain("pine-converter/transform/request-security-different-symbol");
        expect(lines).toContain(
            "const hi = request.security({ symbol: inputs.sym as string, interval: inputs.tf as string }).high.current;",
        );
        expect(lines).toContain(
            "const lo = request.security({ symbol: inputs.sym as string, interval: inputs.tf as string }).low.current;",
        );
    });

    it("skips a `_` placeholder element (no read emitted for it)", () => {
        const { lines, codes } = run(
            '[hi, _] = request.security(syminfo.tickerid, "D", [high, low])\nplot(hi)',
        );
        expect(codes).toEqual([]);
        expect(lines).toContain('const hi = request.security({ interval: "1d" }).high.current;');
        expect(lines.some((l) => l.includes(".low"))).toBe(false);
    });

    it("warns arity-mismatch + binds what it can when names exceed elements", () => {
        const { lines, codes } = run(
            '[a, b, c] = request.security(syminfo.tickerid, "D", [high, low])\nplot(a)\nplot(b)',
        );
        expect(codes).toContain("pine-converter/semantic/security-tuple-arity-mismatch");
        expect(lines).toContain('const a = request.security({ interval: "1d" }).high.current;');
        expect(lines).toContain('const b = request.security({ interval: "1d" }).low.current;');
        // The extra name `c` has no element to bind — never emitted.
        expect(lines.some((l) => l.startsWith("const c ="))).toBe(false);
    });

    it("emits nothing (no multi-return-not-mapped) for a rejected non-literal feed", () => {
        const { lines, codes } = run(
            'sym = close\n[a, b] = request.security(sym, "D", [high, low])\nplot(close)',
        );
        expect(codes).toContain("pine-converter/transform/request-security-not-mapped");
        expect(codes).not.toContain("pine-converter/transform/multi-return-not-mapped");
        expect(lines.some((l) => l.includes("request.security"))).toBe(false);
    });

    it("emits nothing for a non-array (source-not-list) third argument", () => {
        const { lines, codes } = run(
            '[a, b] = request.security(syminfo.tickerid, "D", close)\nplot(close)',
        );
        expect(codes).toContain("pine-converter/semantic/security-tuple-source-not-list");
        expect(codes).not.toContain("pine-converter/transform/multi-return-not-mapped");
        expect(lines.some((l) => l.includes("request.security"))).toBe(false);
    });
});
