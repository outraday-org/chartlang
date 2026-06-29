// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { CallExpression } from "../ast/index.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import type { EmitContext } from "./emitContext.js";
import { emitRequestSecurity, isRequestSecurityCall } from "./requestSecurity.js";

const CTX: EmitContext = {
    annotations: new Map(),
    inputNames: new Set(),
    localNames: new Set(),
    stateSlots: new Map(),
};

function call(expr: string): CallExpression {
    const src = `//@version=6\nindicator("X")\nv = ${expr}\nplot(close)\n`;
    const script = parseStatements(lex(src).tokens).script;
    for (const stmt of script.body) {
        if (stmt.kind === "assignment" && stmt.value.kind === "call-expression") {
            return stmt.value;
        }
    }
    throw new Error("no call expression in fixture");
}

function emit(expr: string): { source: string | null; codes: string[] } {
    const diagnostics = new DiagnosticCollector();
    const source = emitRequestSecurity(call(expr), CTX, diagnostics);
    return { source, codes: diagnostics.toArray().map((d) => d.code) };
}

// Emit with a populated `securityFeedInputs` so an identifier-bound symbol /
// timeframe resolves to its `inputs.<name>` reference.
function emitWith(
    expr: string,
    feedInputs: ReadonlyMap<string, "symbol" | "interval">,
): { source: string | null; codes: string[] } {
    const diagnostics = new DiagnosticCollector();
    const source = emitRequestSecurity(
        call(expr),
        { ...CTX, securityFeedInputs: feedInputs },
        diagnostics,
    );
    return { source, codes: diagnostics.toArray().map((d) => d.code) };
}

describe("isRequestSecurityCall", () => {
    it("recognises request.security and rejects others", () => {
        expect(isRequestSecurityCall(call('request.security(syminfo.tickerid, "1D", close)'))).toBe(
            true,
        );
        expect(isRequestSecurityCall(call("ta.ema(close, 9)"))).toBe(false);
    });
});

describe("emitRequestSecurity", () => {
    it("returns null for a non-request.security call", () => {
        expect(emit("ta.ema(close, 9)").source).toBeNull();
    });

    it("lowers the single-symbol intraday MTF case", () => {
        expect(emit('request.security(syminfo.tickerid, "1D", close)').source).toBe(
            'request.security({ interval: "1d" }).close',
        );
    });

    it("maps each OHLCV source field", () => {
        expect(emit('request.security(syminfo.tickerid, "60", high)').source).toBe(
            'request.security({ interval: "1h" }).high',
        );
        expect(emit('request.security(syminfo.tickerid, "D", hl2)').source).toBe(
            'request.security({ interval: "1d" }).hl2',
        );
    });

    it("carries a literal different symbol into the opts (multi-symbol)", () => {
        const { source, codes } = emit('request.security("NASDAQ:AAPL", "D", close)');
        expect(source).toBe('request.security({ symbol: "NASDAQ:AAPL", interval: "1d" }).close');
        expect(codes).toContain("pine-converter/transform/request-security-different-symbol");
    });

    it("lowers a literal different symbol with a ta.* source to the callback form", () => {
        const { source, codes } = emit('request.security("AMEX:SPY", "1W", ta.ema(close, 9))');
        expect(source).toBe(
            'request.security({ symbol: "AMEX:SPY", interval: "1w" }, (bar) => ta.ema(bar.close, 9))',
        );
        expect(codes).toContain("pine-converter/transform/request-security-different-symbol");
    });

    it("rejects a computed (non-literal) symbol as request-security-not-mapped", () => {
        const { source, codes } = emit('request.security(sym, "D", close)');
        expect(source).toBeNull();
        expect(codes).toContain("pine-converter/transform/request-security-not-mapped");
        expect(codes).not.toContain("pine-converter/transform/request-security-different-symbol");
    });

    it("warns request-security-lookahead-not-supported", () => {
        const { codes } = emit(
            'request.security(syminfo.tickerid, "D", close, lookahead=barmerge.lookahead_on)',
        );
        expect(codes).toContain(
            "pine-converter/transform/request-security-lookahead-not-supported",
        );
    });

    it("lowers a ta.* source to the higher-timeframe callback form", () => {
        expect(emit('request.security(syminfo.tickerid, "D", ta.ema(close, 9))').source).toBe(
            'request.security({ interval: "1d" }, (bar) => ta.ema(bar.close, 9))',
        );
    });

    it("rewrites OHLCV source fields inside the callback body", () => {
        expect(emit('request.security(syminfo.tickerid, "1W", ta.sma(hl2, 20))').source).toBe(
            'request.security({ interval: "1w" }, (bar) => ta.sma(bar.hl2, 20))',
        );
    });

    it("rejects a non-string-literal timeframe", () => {
        const { source, codes } = emit("request.security(syminfo.tickerid, tf, close)");
        expect(source).toBeNull();
        expect(codes).toContain("pine-converter/transform/request-security-not-mapped");
    });

    it("rejects an out-of-table timeframe", () => {
        const { source, codes } = emit('request.security(syminfo.tickerid, "13Z", close)');
        expect(source).toBeNull();
        expect(codes).toContain("pine-converter/transform/request-security-not-mapped");
    });

    it("rejects a call missing positional args", () => {
        const { source, codes } = emit("request.security(syminfo.tickerid)");
        expect(source).toBeNull();
        expect(codes).toContain("pine-converter/transform/request-security-not-mapped");
    });

    it("drops gaps=barmerge.gaps_off with a single info", () => {
        const { source, codes } = emit(
            'request.security(syminfo.tickerid, "D", close, gaps=barmerge.gaps_off)',
        );
        expect(source).toBe('request.security({ interval: "1d" }).close');
        expect(codes).toContain("pine-converter/transform/request-security-gaps-dropped");
        expect(codes).not.toContain("pine-converter/transform/request-security-not-mapped");
    });

    it("recognises gaps=barmerge.gaps_on", () => {
        const { codes } = emit(
            'request.security(syminfo.tickerid, "D", close, gaps=barmerge.gaps_on)',
        );
        expect(codes).toContain("pine-converter/transform/request-security-gaps-dropped");
    });

    it("drops gaps once per script across multiple feeds", () => {
        const diagnostics = new DiagnosticCollector();
        emitRequestSecurity(
            call('request.security(syminfo.tickerid, "D", close, gaps=barmerge.gaps_off)'),
            CTX,
            diagnostics,
        );
        emitRequestSecurity(
            call('request.security(syminfo.tickerid, "W", high, gaps=barmerge.gaps_off)'),
            CTX,
            diagnostics,
        );
        const gaps = diagnostics
            .toArray()
            .filter((d) => d.code === "pine-converter/transform/request-security-gaps-dropped");
        expect(gaps).toHaveLength(1);
    });

    it("lowers an input-bound symbol + timeframe to inputs.<name> refs", () => {
        const { source, codes } = emitWith(
            "request.security(sym, period, close)",
            new Map([
                ["sym", "symbol"],
                ["period", "interval"],
            ]),
        );
        expect(source).toBe(
            "request.security({ symbol: inputs.sym as string, interval: inputs.period as string }).close",
        );
        expect(codes).toContain("pine-converter/transform/request-security-different-symbol");
    });

    it("lowers a chart symbol + input-bound timeframe with no different-symbol info", () => {
        const { source, codes } = emitWith(
            "request.security(syminfo.tickerid, period, close)",
            new Map([["period", "interval"]]),
        );
        expect(source).toBe("request.security({ interval: inputs.period as string }).close");
        expect(codes).not.toContain("pine-converter/transform/request-security-different-symbol");
    });

    it("rejects an input-bound symbol whose input is missing from the feed map", () => {
        const { source, codes } = emitWith("request.security(sym, period, close)", new Map());
        expect(source).toBeNull();
        expect(codes).toContain("pine-converter/transform/request-security-not-mapped");
    });
});
