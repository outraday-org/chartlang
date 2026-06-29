// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { RequestedFeed } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { CompileDiagnostic } from "../diagnostics.js";
import { createProgramForSource } from "../program.js";
import { extractInputs } from "./extractInputs.js";
import { extractRequestAnalysis } from "./extractRequestedIntervals.js";

function analyseFeeds(source: string): Readonly<{
    feeds: ReadonlyArray<RequestedFeed>;
    intervals: ReadonlyArray<string>;
    diagnostics: ReadonlyArray<CompileDiagnostic>;
}> {
    const { sourceFile, checker } = createProgramForSource(source, {
        sourcePath: "prop.chart.ts",
    });
    const inputResult = extractInputs(sourceFile, checker, "prop.chart.ts");
    const diagnostics: CompileDiagnostic[] = [...inputResult.diagnostics];
    const analysis = extractRequestAnalysis(
        sourceFile,
        checker,
        inputResult.inputs,
        diagnostics,
        "prop.chart.ts",
    );
    return Object.freeze({
        feeds: analysis.feeds,
        intervals: analysis.intervals,
        diagnostics: Object.freeze(diagnostics.slice()),
    });
}

const INTERVAL = fc.constantFrom("1D", "5m", "1W", "");
const SYMBOL = fc.constantFrom("AMEX:SPY", "NASDAQ:QQQ");

describe("extractRequestAnalysis — feed-resolution properties", () => {
    it("resolves an input default identically to the same string literal (both axes)", () => {
        fc.assert(
            fc.property(INTERVAL, SYMBOL, fc.boolean(), (interval, symbol, symbolPresent) => {
                const litSym = symbolPresent ? `symbol: ${JSON.stringify(symbol)}, ` : "";
                const literal = analyseFeeds(`
import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    compute: ({ request }) => {
        request.security({ ${litSym}interval: ${JSON.stringify(interval)} });
    },
});
`);
                const defSymInput = symbolPresent
                    ? `sym: input.symbol(${JSON.stringify(symbol)}), `
                    : "";
                const defSymOpt = symbolPresent ? "symbol: inputs.sym, " : "";
                const viaDefault = analyseFeeds(`
import { defineIndicator, input } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    inputs: { ${defSymInput}tf: input.interval(${JSON.stringify(interval)}) },
    compute: ({ inputs, request }) => {
        request.security({ ${defSymOpt}interval: inputs.tf });
    },
});
`);

                // An input default is just a compile-time-resolvable literal:
                // the two provision methods must produce byte-identical analysis.
                expect(viaDefault.feeds).toEqual(literal.feeds);
                expect(viaDefault.intervals).toEqual(literal.intervals);
                expect(literal.diagnostics).toEqual([]);
                expect(viaDefault.diagnostics).toEqual([]);

                // A chart-symbol + chart-timeframe ("") pair is the primary
                // stream (no feed); every other combination is exactly one feed.
                const expectedFeeds = !symbolPresent && interval === "" ? 0 : 1;
                expect(literal.feeds.length).toBe(expectedFeeds);
            }),
            { numRuns: 40 },
        );
    });

    it("rejects a genuinely-dynamic interval with no feed, however it is spelled", () => {
        fc.assert(
            fc.property(
                fc.constantFrom("tf", "outer + 1", "`${outer}`", "String(outer)"),
                (intervalExpr) => {
                    const result = analyseFeeds(`
import { defineIndicator } from "@invinite-org/chartlang-core";
declare const outer: string;
const tf = "1D";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    compute: ({ request }) => {
        request.security({ interval: ${intervalExpr} });
    },
});
`);
                    expect(result.feeds).toEqual([]);
                    expect(result.intervals).toEqual([]);
                    expect(result.diagnostics.map((d) => d.code)).toContain(
                        "request-security-interval-not-literal",
                    );
                },
            ),
            { numRuns: 20 },
        );
    });

    it("rejects a genuinely-dynamic symbol with no feed, however it is spelled", () => {
        fc.assert(
            fc.property(
                fc.constantFrom("sym", "outer + ':SPY'", "`${outer}`", "String(outer)"),
                (symbolExpr) => {
                    const result = analyseFeeds(`
import { defineIndicator } from "@invinite-org/chartlang-core";
declare const outer: string;
const sym = "AMEX:SPY";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    compute: ({ request }) => {
        request.security({ symbol: ${symbolExpr}, interval: "1D" });
    },
});
`);
                    expect(result.feeds).toEqual([]);
                    expect(result.diagnostics.map((d) => d.code)).toContain(
                        "request-security-symbol-not-literal",
                    );
                },
            ),
            { numRuns: 20 },
        );
    });
});
