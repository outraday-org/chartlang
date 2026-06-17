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

    it("warns request-security-different-symbol for a non-tickerid symbol", () => {
        const { source, codes } = emit('request.security("AAPL", "D", close)');
        expect(source).toBe('request.security({ interval: "1d" }).close');
        expect(codes).toContain("pine-converter/transform/request-security-different-symbol");
    });

    it("warns request-security-lookahead-not-supported", () => {
        const { codes } = emit(
            'request.security(syminfo.tickerid, "D", close, lookahead=barmerge.lookahead_on)',
        );
        expect(codes).toContain(
            "pine-converter/transform/request-security-lookahead-not-supported",
        );
    });

    it("passes a non-OHLCV source expression through with the emitter", () => {
        expect(emit('request.security(syminfo.tickerid, "D", ta.ema(close, 9))').source).toBe(
            'request.security({ interval: "1d" }).ta.ema(bar.close, 9)',
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
});
