// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { CallExpression, ExpressionNode } from "../ast/index.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import {
    resolveSecurityFeed,
    securityCallbackRead,
    securityDataRead,
    securityField,
    securityOpts,
} from "./securityShape.js";

// Parse `v = <expr>` and return the call expression's positional arg values, so
// each security source/symbol/timeframe node comes straight from the parser.
function args(expr: string): readonly ExpressionNode[] {
    const src = `//@version=6\nindicator("X")\nv = ${expr}\nplot(close)\n`;
    const script = parseStatements(lex(src).tokens).script;
    for (const stmt of script.body) {
        if (stmt.kind === "assignment" && stmt.value.kind === "call-expression") {
            const call: CallExpression = stmt.value;
            return call.args.filter((arg) => arg.name === null).map((arg) => arg.value);
        }
    }
    throw new Error("no call expression in fixture");
}

describe("securityField", () => {
    it("maps a bare OHLCV identifier to its field", () => {
        const [, , high] = args('request.security(syminfo.tickerid, "D", high)');
        expect(securityField(high)).toBe("high");
    });

    it("returns null for a non-OHLCV identifier", () => {
        const [, , other] = args('request.security(syminfo.tickerid, "D", myval)');
        expect(securityField(other)).toBeNull();
    });

    it("returns null for a non-identifier source (a call/expression)", () => {
        const [, , taCall] = args('request.security(syminfo.tickerid, "D", ta.ema(close, 9))');
        expect(securityField(taCall)).toBeNull();
    });
});

describe("resolveSecurityFeed", () => {
    it("resolves syminfo.tickerid to the chart's own symbol (omitted)", () => {
        const [symbol, tf] = args('request.security(syminfo.tickerid, "60", close)');
        expect(resolveSecurityFeed(symbol, tf)).toEqual({ symbol: null, interval: "1h" });
    });

    it("resolves a literal cross-symbol", () => {
        const [symbol, tf] = args('request.security("NASDAQ:AAPL", "D", close)');
        expect(resolveSecurityFeed(symbol, tf)).toEqual({
            symbol: "NASDAQ:AAPL",
            interval: "1d",
        });
    });

    it("rejects a non-literal / non-tickerid symbol", () => {
        const [symbol, tf] = args('request.security(sym, "D", close)');
        expect(resolveSecurityFeed(symbol, tf)).toBeNull();
    });

    it("rejects a non-literal timeframe", () => {
        const [symbol, tf] = args("request.security(syminfo.tickerid, tf, close)");
        expect(resolveSecurityFeed(symbol, tf)).toBeNull();
    });

    it("rejects an out-of-table timeframe", () => {
        const [symbol, tf] = args('request.security(syminfo.tickerid, "13Z", close)');
        expect(resolveSecurityFeed(symbol, tf)).toBeNull();
    });
});

describe("securityOpts", () => {
    it("omits the symbol for the chart's own feed", () => {
        expect(securityOpts(null, "1d")).toBe('{ interval: "1d" }');
    });

    it("carries a cross-symbol feed", () => {
        expect(securityOpts("NASDAQ:QQQ", "1w")).toBe('{ symbol: "NASDAQ:QQQ", interval: "1w" }');
    });
});

describe("securityDataRead / securityCallbackRead", () => {
    it("builds the data form for an OHLCV field", () => {
        expect(securityDataRead('{ interval: "1d" }', "high")).toBe(
            'request.security({ interval: "1d" }).high',
        );
    });

    it("builds the callback form for a computed body", () => {
        expect(securityCallbackRead('{ interval: "1d" }', "ta.ema(bar.close, 9)")).toBe(
            'request.security({ interval: "1d" }, (bar) => ta.ema(bar.close, 9))',
        );
    });
});
