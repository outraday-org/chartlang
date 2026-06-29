// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { CallExpression, ExpressionNode } from "../ast/index.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import {
    type SecurityFeedAxis,
    type SecurityFeedInputs,
    resolveSecurityFeed,
} from "./securityShape.js";

// Parse `v = request.security(<symbol>, <tf>, close)` and return the symbol +
// timeframe arg nodes straight from the parser.
function feedArgs(symbolSrc: string, tfSrc: string): readonly [ExpressionNode, ExpressionNode] {
    const src = `//@version=6\nindicator("X")\nv = request.security(${symbolSrc}, ${tfSrc}, close)\nplot(close)\n`;
    const script = parseStatements(lex(src).tokens).script;
    for (const stmt of script.body) {
        if (stmt.kind === "assignment" && stmt.value.kind === "call-expression") {
            const call: CallExpression = stmt.value;
            const positional = call.args.filter((arg) => arg.name === null).map((arg) => arg.value);
            return [positional[0], positional[1]];
        }
    }
    throw new Error("no call expression in fixture");
}

// A symbol-axis shape: the Pine source, the feed-input axis it registers (if
// any), and the expected resolved `symbol` emit source (or `null` for chart
// symbol, `undefined` for an un-mappable reject).
type SymbolShape = Readonly<{
    src: string;
    input?: readonly [string, SecurityFeedAxis];
    expected: string | null | undefined;
}>;

const SYMBOL_SHAPES: readonly SymbolShape[] = [
    { src: "syminfo.tickerid", expected: null },
    { src: '"NASDAQ:AAPL"', expected: '"NASDAQ:AAPL"' },
    { src: "sym", input: ["sym", "symbol"], expected: "inputs.sym as string" },
    { src: "sym", input: ["sym", "interval"], expected: undefined },
    { src: "sym", expected: undefined },
];

// An interval-axis shape: the Pine source, the feed-input axis it registers (if
// any), and the expected resolved `interval` emit source (or `null` reject).
type IntervalShape = Readonly<{
    src: string;
    input?: readonly [string, SecurityFeedAxis];
    expected: string | null;
}>;

const INTERVAL_SHAPES: readonly IntervalShape[] = [
    { src: '"D"', expected: '"1d"' },
    { src: '""', expected: '""' },
    { src: "tf", input: ["tf", "interval"], expected: "inputs.tf as string" },
    { src: "tf", input: ["tf", "symbol"], expected: null },
    { src: '"999"', expected: null },
    { src: "tf", expected: null },
];

describe("resolveSecurityFeed — property", () => {
    it("resolves each symbol × timeframe shape to its expected emit sources", () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...SYMBOL_SHAPES),
                fc.constantFrom(...INTERVAL_SHAPES),
                (symbolShape, intervalShape) => {
                    const sources = new Map<string, SecurityFeedAxis>();
                    if (symbolShape.input !== undefined) {
                        sources.set(symbolShape.input[0], symbolShape.input[1]);
                    }
                    if (intervalShape.input !== undefined) {
                        sources.set(intervalShape.input[0], intervalShape.input[1]);
                    }
                    const inputs: SecurityFeedInputs = sources;
                    const [symbol, tf] = feedArgs(symbolShape.src, intervalShape.src);
                    const feed = resolveSecurityFeed(symbol, tf, inputs);
                    if (symbolShape.expected === undefined || intervalShape.expected === null) {
                        // Either axis un-mappable → the whole feed rejects.
                        expect(feed).toBeNull();
                        return;
                    }
                    expect(feed).toEqual({
                        symbol: symbolShape.expected,
                        interval: intervalShape.expected,
                    });
                },
            ),
        );
    });
});
