// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { CallExpression, ExpressionNode } from "../ast/index.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import {
    type SecurityFeedInputs,
    collectSecurityFeedInputs,
    resolveSecurityFeed,
    securityCallbackRead,
    securityDataRead,
    securityField,
    securityOpts,
} from "./securityShape.js";

const NO_INPUTS: SecurityFeedInputs = new Map();

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

describe("collectSecurityFeedInputs", () => {
    // Parse a whole script and collect its feed-input axes.
    function collect(body: string): SecurityFeedInputs {
        const src = `//@version=6\nindicator("X")\n${body}\nplot(close)\n`;
        return collectSecurityFeedInputs(parseStatements(lex(src).tokens).script);
    }

    it("classifies input.symbol, input.string, and input.timeframe feed axes", () => {
        const sources = collect(
            [
                'sym = input.symbol("NASDAQ:QQQ")',
                'dropdown = input.string("AMEX:SPY", options=["AMEX:SPY", "NASDAQ:QQQ"])',
                'string tf = input.timeframe("D")',
            ].join("\n"),
        );
        expect(sources.get("sym")).toBe("symbol");
        expect(sources.get("dropdown")).toBe("symbol");
        expect(sources.get("tf")).toBe("interval");
    });

    it("ignores a non-feed input and a non-input binding", () => {
        const sources = collect("len = input.int(14)\nx = close + 1");
        expect(sources.has("len")).toBe(false);
        expect(sources.has("x")).toBe(false);
    });
});

describe("resolveSecurityFeed", () => {
    it("resolves syminfo.tickerid to the chart's own symbol (omitted)", () => {
        const [symbol, tf] = args('request.security(syminfo.tickerid, "60", close)');
        expect(resolveSecurityFeed(symbol, tf, NO_INPUTS)).toEqual({
            symbol: null,
            interval: '"1h"',
        });
    });

    it("resolves a literal cross-symbol to its emit sources", () => {
        const [symbol, tf] = args('request.security("NASDAQ:AAPL", "D", close)');
        expect(resolveSecurityFeed(symbol, tf, NO_INPUTS)).toEqual({
            symbol: '"NASDAQ:AAPL"',
            interval: '"1d"',
        });
    });

    it("resolves input-bound symbol + timeframe to inputs.<name> refs", () => {
        const [symbol, tf] = args("request.security(sym, period, close)");
        const inputs: SecurityFeedInputs = new Map([
            ["sym", "symbol"],
            ["period", "interval"],
        ]);
        expect(resolveSecurityFeed(symbol, tf, inputs)).toEqual({
            symbol: "inputs.sym as string",
            interval: "inputs.period as string",
        });
    });

    it("resolves input.string-bound dropdown symbols to inputs.<name> refs", () => {
        const [symbol, tf] = args('request.security(sym, "D", close)');
        const inputs: SecurityFeedInputs = new Map([["sym", "symbol"]]);
        expect(resolveSecurityFeed(symbol, tf, inputs)).toEqual({
            symbol: "inputs.sym as string",
            interval: '"1d"',
        });
    });

    it("folds a string-literal concat symbol to a single emit literal", () => {
        const [symbol, tf] = args('request.security("ESD:" + "AAPL" + ";EARNINGS", "D", open)');
        expect(resolveSecurityFeed(symbol, tf, NO_INPUTS)).toEqual({
            symbol: '"ESD:AAPL;EARNINGS"',
            interval: '"1d"',
        });
    });

    it("resolves an empty literal timeframe to the chart timeframe", () => {
        const [symbol, tf] = args('request.security(syminfo.tickerid, "", close)');
        expect(resolveSecurityFeed(symbol, tf, NO_INPUTS)).toEqual({
            symbol: null,
            interval: '""',
        });
    });

    it("rejects a computed (non-input) symbol", () => {
        const [symbol, tf] = args('request.security(sym, "D", close)');
        expect(resolveSecurityFeed(symbol, tf, NO_INPUTS)).toBeNull();
    });

    it("rejects an input of the wrong axis used as a symbol", () => {
        const [symbol, tf] = args('request.security(period, "D", close)');
        const inputs: SecurityFeedInputs = new Map([["period", "interval"]]);
        expect(resolveSecurityFeed(symbol, tf, inputs)).toBeNull();
    });

    it("rejects non-literal string concat symbols", () => {
        const [symbol, tf] = args('request.security(prefix + ";EARNINGS", "D", close)');
        expect(resolveSecurityFeed(symbol, tf, NO_INPUTS)).toBeNull();
    });

    it("rejects non-plus binary expressions as symbols", () => {
        const [symbol, tf] = args('request.security("NASDAQ:AAPL" == sym, "D", close)');
        expect(resolveSecurityFeed(symbol, tf, NO_INPUTS)).toBeNull();
    });

    it("rejects a computed (non-input) timeframe", () => {
        const [symbol, tf] = args("request.security(syminfo.tickerid, tf, close)");
        expect(resolveSecurityFeed(symbol, tf, NO_INPUTS)).toBeNull();
    });

    it("rejects an out-of-table timeframe", () => {
        const [symbol, tf] = args('request.security(syminfo.tickerid, "13Z", close)');
        expect(resolveSecurityFeed(symbol, tf, NO_INPUTS)).toBeNull();
    });
});

describe("securityOpts", () => {
    it("omits the symbol for the chart's own feed", () => {
        expect(securityOpts(null, '"1d"')).toBe('{ interval: "1d" }');
    });

    it("carries a literal cross-symbol feed", () => {
        expect(securityOpts('"NASDAQ:QQQ"', '"1w"')).toBe(
            '{ symbol: "NASDAQ:QQQ", interval: "1w" }',
        );
    });

    it("splices input.<name> refs verbatim", () => {
        expect(securityOpts("inputs.sym", "inputs.tf")).toBe(
            "{ symbol: inputs.sym, interval: inputs.tf }",
        );
    });
});

describe("securityDataRead / securityCallbackRead", () => {
    it("builds the data form for an OHLCV field", () => {
        expect(securityDataRead('{ interval: "1d" }', "high")).toBe(
            'request.security({ interval: "1d" }).high.current',
        );
    });

    it("builds the callback form for a computed body", () => {
        expect(securityCallbackRead('{ interval: "1d" }', "ta.ema(bar.close, 9)")).toBe(
            'request.security({ interval: "1d" }, (bar) => ta.ema(bar.close, 9)).current',
        );
    });
});
