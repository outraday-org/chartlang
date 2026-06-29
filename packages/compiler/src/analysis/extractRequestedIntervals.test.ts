// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { RequestedFeed } from "@invinite-org/chartlang-core";

import type { CompileDiagnostic } from "../diagnostics.js";
import { createProgramForSource } from "../program.js";
import { extractInputs } from "./extractInputs.js";
import { extractRequestAnalysis, extractRequestedIntervals } from "./extractRequestedIntervals.js";

function run(source: string): Readonly<{
    intervals: ReadonlyArray<string>;
    diagnostics: ReadonlyArray<CompileDiagnostic>;
}> {
    const { sourceFile, checker } = createProgramForSource(source, {
        sourcePath: "demo.chart.ts",
    });
    const inputResult = extractInputs(sourceFile, checker, "demo.chart.ts");
    const diagnostics: CompileDiagnostic[] = [...inputResult.diagnostics];
    const intervals = extractRequestedIntervals(
        sourceFile,
        checker,
        inputResult.inputs,
        diagnostics,
        "demo.chart.ts",
    );
    return Object.freeze({
        intervals,
        diagnostics: Object.freeze(diagnostics.slice()),
    });
}

function runWithInputs(
    source: string,
    inputs: Readonly<Record<string, Readonly<Record<string, unknown>>>>,
): Readonly<{
    intervals: ReadonlyArray<string>;
    diagnostics: ReadonlyArray<CompileDiagnostic>;
}> {
    const { sourceFile, checker } = createProgramForSource(source, {
        sourcePath: "demo.chart.ts",
    });
    const diagnostics: CompileDiagnostic[] = [];
    const intervals = extractRequestedIntervals(
        sourceFile,
        checker,
        inputs,
        diagnostics,
        "demo.chart.ts",
    );
    return Object.freeze({
        intervals,
        diagnostics: Object.freeze(diagnostics.slice()),
    });
}

function runFeeds(source: string): Readonly<{
    intervals: ReadonlyArray<string>;
    feeds: ReadonlyArray<RequestedFeed>;
    diagnostics: ReadonlyArray<CompileDiagnostic>;
}> {
    const { sourceFile, checker } = createProgramForSource(source, {
        sourcePath: "demo.chart.ts",
    });
    const inputResult = extractInputs(sourceFile, checker, "demo.chart.ts");
    const diagnostics: CompileDiagnostic[] = [...inputResult.diagnostics];
    const analysis = extractRequestAnalysis(
        sourceFile,
        checker,
        inputResult.inputs,
        diagnostics,
        "demo.chart.ts",
    );
    return Object.freeze({
        intervals: analysis.intervals,
        feeds: analysis.feeds,
        diagnostics: Object.freeze(diagnostics.slice()),
    });
}

function runFeedsWithInputs(
    source: string,
    inputs: Readonly<Record<string, Readonly<Record<string, unknown>>>>,
): Readonly<{
    intervals: ReadonlyArray<string>;
    feeds: ReadonlyArray<RequestedFeed>;
    diagnostics: ReadonlyArray<CompileDiagnostic>;
}> {
    const { sourceFile, checker } = createProgramForSource(source, {
        sourcePath: "demo.chart.ts",
    });
    const diagnostics: CompileDiagnostic[] = [];
    const analysis = extractRequestAnalysis(
        sourceFile,
        checker,
        inputs,
        diagnostics,
        "demo.chart.ts",
    );
    return Object.freeze({
        intervals: analysis.intervals,
        feeds: analysis.feeds,
        diagnostics: Object.freeze(diagnostics.slice()),
    });
}

describe("extractRequestedIntervals", () => {
    it("extracts distinct literal request.security intervals sorted", () => {
        const result = run(`
import { defineIndicator, request } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    compute: () => {
        request.security({ interval: "5m" });
        request.security({ interval: "1D" });
        request.security({ interval: "5m" });
    },
});
`);
        expect(result.intervals).toEqual(["1D", "5m"]);
        expect(result.diagnostics).toEqual([]);
    });

    it("extracts request.security and request.lowerTf intervals together", () => {
        const result = run(`
import { defineIndicator, request } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    compute: () => {
        request.security({ interval: "1D" });
        request.lowerTf({ interval: "30s" });
    },
});
`);
        expect(result.intervals).toEqual(["1D", "30s"]);
        expect(result.diagnostics).toEqual([]);
    });

    it("emits a diagnostic for dynamic interval values", () => {
        const result = run(`
import { defineIndicator, request } from "@invinite-org/chartlang-core";
const tf = "1D";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    compute: () => {
        request.security({ interval: tf });
    },
});
`);
        expect(result.intervals).toEqual([]);
        expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
            "request-security-interval-not-literal",
        );
        expect(result.diagnostics[0]?.message).toBe(
            "request.security({ interval }) must be a string literal or input.enum value",
        );
    });

    it("emits a diagnostic for dynamic request.lowerTf interval values", () => {
        const result = run(`
import { defineIndicator, request } from "@invinite-org/chartlang-core";
const tf = "30s";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    compute: () => {
        request.lowerTf({ interval: tf });
    },
});
`);
        expect(result.intervals).toEqual([]);
        expect(result.diagnostics.map((d) => d.code)).toEqual([
            "request-lower-tf-interval-not-literal",
        ]);
        expect(result.diagnostics[0]?.message).toBe(
            "request.lowerTf({ interval }) must be a string literal or input.enum value",
        );
    });

    it("returns an empty interval set when no request.security calls exist", () => {
        const result = run(`
import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    compute: () => {},
});
`);
        expect(result.intervals).toEqual([]);
        expect(result.diagnostics).toEqual([]);
    });

    it("expands inputs.enum interval references to all enum options", () => {
        const result = run(`
import { defineIndicator, input } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    inputs: {
        htf: input.enum("1D", ["1D", "1W"] as const),
    },
    compute: ({ inputs, request }) => {
        request.security({ interval: inputs.htf });
    },
});
`);
        expect(result.intervals).toEqual(["1D", "1W"]);
        expect(result.diagnostics).toEqual([]);
    });

    it("ignores malformed request.security opts without an interval property", () => {
        const result = run(`
import { defineIndicator, request } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    compute: () => {
        request.security();
        request.security("1D");
        request.security({});
    },
});
`);
        expect(result.intervals).toEqual([]);
        expect(result.diagnostics).toEqual([]);
    });

    it("accepts an input.interval default and rejects only a missing reference", () => {
        // The invariant reversed in Task 3: an interval bound to an
        // `input.interval` default now resolves through its literal default
        // (symmetric with `input.symbol`); a genuinely-missing `inputs.<name>`
        // reference is still a dynamic expression and rejects.
        const result = run(`
import { defineIndicator, input } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    inputs: {
        htf: input.interval("1D"),
    },
    compute: ({ inputs, request }) => {
        request.security({ interval: inputs.htf });
        request.security({ interval: inputs.missing });
    },
});
`);
        expect(result.intervals).toEqual(["1D"]);
        expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
            "request-security-interval-not-literal",
        ]);
    });

    it("rejects an interval bound to a non-interval input descriptor", () => {
        // An `inputs.<name>` whose descriptor is not an `input.interval` (here a
        // plain `input.string`) is not a feed interval — it falls through to the
        // dynamic diagnostic, mirroring the symbol axis' non-symbol reject.
        const result = run(`
import { defineIndicator, input } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    inputs: {
        tf: input.string("1D"),
    },
    compute: ({ inputs, request }) => {
        request.security({ interval: inputs.tf });
    },
});
`);
        expect(result.intervals).toEqual([]);
        expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
            "request-security-interval-not-literal",
        ]);
    });

    it("rejects malformed enum descriptors from manual callers", () => {
        const result = runWithInputs(
            `
import { request } from "@invinite-org/chartlang-core";
request.security({ interval: inputs.htf });
request.security({ interval: inputs.bad });
`,
            {
                htf: { kind: "enum", options: "1D" },
                bad: { kind: "enum", options: ["1D", 1] },
            },
        );
        expect(result.intervals).toEqual([]);
        expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
            "request-security-interval-not-literal",
            "request-security-interval-not-literal",
        ]);
    });
});

function analyse(
    source: string,
    validateExpressions = false,
): ReturnType<typeof extractRequestAnalysis> & { diagnostics: ReadonlyArray<CompileDiagnostic> } {
    const { sourceFile, checker } = createProgramForSource(source, {
        sourcePath: "demo.chart.ts",
    });
    const inputResult = extractInputs(sourceFile, checker, "demo.chart.ts");
    const diagnostics: CompileDiagnostic[] = [...inputResult.diagnostics];
    const analysis = extractRequestAnalysis(
        sourceFile,
        checker,
        inputResult.inputs,
        diagnostics,
        "demo.chart.ts",
        validateExpressions,
    );
    return Object.freeze({ ...analysis, diagnostics: Object.freeze(diagnostics.slice()) });
}

describe("extractRequestAnalysis security expressions", () => {
    it("still emits the interval and records the expression descriptor", () => {
        const result = analyse(
            `import { request } from "@invinite-org/chartlang-core";
const trend = request.security({ interval: "1W" }, (bar) => bar.close);`,
        );
        expect(result.intervals).toEqual(["1W"]);
        expect(result.securityExpressions).toEqual([
            { slotId: "demo.chart.ts:2:15#0", interval: "1W", paramName: "bar" },
        ]);
    });

    it("records a function-expression callback and reads its param name", () => {
        const result = analyse(
            `import { request } from "@invinite-org/chartlang-core";
const trend = request.security({ interval: "1D" }, function (candle) { return candle.close; });`,
        );
        expect(result.securityExpressions).toEqual([
            { slotId: "demo.chart.ts:2:15#0", interval: "1D", paramName: "candle" },
        ]);
    });

    it("sorts multiple expression units by slotId", () => {
        const result = analyse(
            `import { request } from "@invinite-org/chartlang-core";
const a = request.security({ interval: "1D" }, (bar) => bar.close);
const b = request.security({ interval: "1W" }, (bar) => bar.open);`,
        );
        expect(result.securityExpressions.map((e) => e.interval)).toEqual(["1D", "1W"]);
        expect(result.securityExpressions.map((e) => e.slotId)).toEqual(
            [...result.securityExpressions.map((e) => e.slotId)].sort(),
        );
    });

    it("omits a descriptor when the interval is not a string literal", () => {
        const result = analyse(
            `import { request } from "@invinite-org/chartlang-core";
const trend = request.security({ interval: inputs.htf }, (bar) => bar.close);`,
        );
        expect(result.securityExpressions).toEqual([]);
        expect(result.diagnostics.map((d) => d.code)).toContain(
            "request-security-interval-not-literal",
        );
    });

    it("records no expression unit for the data-only form", () => {
        const result = analyse(
            `import { request } from "@invinite-org/chartlang-core";
const weekly = request.security({ interval: "1W" });`,
        );
        expect(result.intervals).toEqual(["1W"]);
        expect(result.securityExpressions).toEqual([]);
    });

    it("records an empty paramName for a no-parameter callback", () => {
        const result = analyse(
            `import { request } from "@invinite-org/chartlang-core";
const trend = request.security({ interval: "1W" }, () => 5);`,
        );
        expect(result.securityExpressions).toEqual([
            { slotId: "demo.chart.ts:2:15#0", interval: "1W", paramName: "" },
        ]);
    });

    it("records an empty paramName for a destructured callback parameter", () => {
        const result = analyse(
            `import { request } from "@invinite-org/chartlang-core";
const trend = request.security({ interval: "1W" }, ({ close }) => close);`,
        );
        expect(result.securityExpressions).toEqual([
            { slotId: "demo.chart.ts:2:15#0", interval: "1W", paramName: "" },
        ]);
    });

    it("omits a descriptor when the opts is not an object literal", () => {
        const result = analyse(
            `import { request } from "@invinite-org/chartlang-core";
declare const opts: { interval: string };
const trend = request.security(opts, (bar) => bar.close);`,
        );
        expect(result.securityExpressions).toEqual([]);
    });

    it("omits a descriptor when the opts object literal has no interval property", () => {
        // The interval property is structurally absent; the raw extractor runs
        // regardless of the resulting type error.
        const result = analyse(
            `import { request } from "@invinite-org/chartlang-core";
// @ts-expect-error opts missing required interval
const trend = request.security({ notInterval: "x" }, (bar) => bar.close);`,
        );
        expect(result.securityExpressions).toEqual([]);
    });

    it("runs the capture check only when validateExpressions is set", () => {
        const captured = `import { request } from "@invinite-org/chartlang-core";
const trend = request.security({ interval: "1W" }, (bar) => bar.close[k]);`;
        expect(analyse(captured, false).diagnostics).toEqual([]);
        expect(analyse(captured, true).diagnostics.map((d) => d.code)).toContain(
            "request-security-expr-captures-local",
        );
    });

    it("attaches a literal symbol to the expression descriptor", () => {
        const result = analyse(
            `import { request } from "@invinite-org/chartlang-core";
const trend = request.security({ symbol: "NASDAQ:AAPL", interval: "1W" }, (bar) => bar.close);`,
        );
        expect(result.securityExpressions).toEqual([
            {
                slotId: "demo.chart.ts:2:15#0",
                symbol: "NASDAQ:AAPL",
                interval: "1W",
                paramName: "bar",
            },
        ]);
    });

    it("attaches an input.symbol default to the expression descriptor", () => {
        const result = analyse(
            `import { defineIndicator, input } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    inputs: { sym: input.symbol("AMEX:SPY") },
    compute: ({ inputs, request }) => {
        request.security({ symbol: inputs.sym, interval: "1D" }, (bar) => bar.close);
    },
});`,
        );
        expect(result.securityExpressions).toEqual([
            {
                slotId: "demo.chart.ts:7:9#0",
                symbol: "AMEX:SPY",
                interval: "1D",
                paramName: "bar",
            },
        ]);
    });

    it("anchors an expression unit on an input.interval default", () => {
        const result = analyse(
            `import { defineIndicator, input } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    inputs: { tf: input.interval("1D") },
    compute: ({ inputs, request }) => {
        request.security({ interval: inputs.tf }, (bar) => bar.close);
    },
});`,
        );
        expect(result.securityExpressions).toEqual([
            { slotId: "demo.chart.ts:7:9#0", interval: "1D", paramName: "bar" },
        ]);
        expect(result.diagnostics).toEqual([]);
    });

    it("records no expression unit for an empty (chart-timeframe) input.interval default", () => {
        // The chart timeframe is the main clock, not a higher-timeframe
        // expression clock — so no descriptor (and no feed, no diagnostic).
        const result = analyse(
            `import { defineIndicator, input } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    inputs: { tf: input.interval("") },
    compute: ({ inputs, request }) => {
        request.security({ interval: inputs.tf }, (bar) => bar.close);
    },
});`,
        );
        expect(result.securityExpressions).toEqual([]);
        expect(result.feeds).toEqual([]);
        expect(result.diagnostics).toEqual([]);
    });

    it("omits the descriptor symbol for an input.enum symbol", () => {
        const result = analyse(
            `import { defineIndicator, input } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    inputs: { sym: input.enum("A", ["A", "B"] as const) },
    compute: ({ inputs, request }) => {
        request.security({ symbol: inputs.sym, interval: "1D" }, (bar) => bar.close);
    },
});`,
        );
        expect(result.securityExpressions).toEqual([
            { slotId: "demo.chart.ts:7:9#0", interval: "1D", paramName: "bar" },
        ]);
    });

    it("omits the descriptor symbol for an empty-literal symbol", () => {
        const result = analyse(
            `import { request } from "@invinite-org/chartlang-core";
const trend = request.security({ symbol: "", interval: "1W" }, (bar) => bar.close);`,
        );
        expect(result.securityExpressions).toEqual([
            { slotId: "demo.chart.ts:2:15#0", interval: "1W", paramName: "bar" },
        ]);
    });

    it("omits the descriptor symbol for a dynamic symbol (interval still anchors)", () => {
        const result = analyse(
            `import { request } from "@invinite-org/chartlang-core";
declare const s: string;
const trend = request.security({ symbol: s, interval: "1W" }, (bar) => bar.close);`,
        );
        expect(result.securityExpressions).toEqual([
            { slotId: "demo.chart.ts:3:15#0", interval: "1W", paramName: "bar" },
        ]);
        expect(result.diagnostics.map((d) => d.code)).toContain(
            "request-security-symbol-not-literal",
        );
    });
});

describe("extractRequestAnalysis requested feeds", () => {
    it("records a literal symbol+interval feed not joined to requestedIntervals", () => {
        const result = runFeeds(`
import { defineIndicator, request } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    compute: () => {
        request.security({ symbol: "AMEX:SPY", interval: "1D" });
    },
});
`);
        expect(result.feeds).toEqual([{ symbol: "AMEX:SPY", interval: "1D" }]);
        expect(result.intervals).toEqual([]);
        expect(result.diagnostics).toEqual([]);
    });

    it("records an omitted-symbol feed and joins its interval to requestedIntervals", () => {
        const result = runFeeds(`
import { defineIndicator, request } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    compute: () => {
        request.security({ interval: "1W" });
    },
});
`);
        expect(result.feeds).toEqual([{ interval: "1W" }]);
        expect(result.intervals).toEqual(["1W"]);
        expect(result.diagnostics).toEqual([]);
    });

    it("treats an empty-literal symbol as the chart symbol", () => {
        const result = runFeeds(`
import { defineIndicator, request } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    compute: () => {
        request.security({ symbol: "", interval: "1D" });
    },
});
`);
        expect(result.feeds).toEqual([{ interval: "1D" }]);
        expect(result.intervals).toEqual(["1D"]);
        expect(result.diagnostics).toEqual([]);
    });

    it("resolves an input.symbol default into the feed", () => {
        const result = runFeeds(`
import { defineIndicator, input } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    inputs: { sym: input.symbol("NASDAQ:QQQ") },
    compute: ({ inputs, request }) => {
        request.security({ symbol: inputs.sym, interval: "1D" });
    },
});
`);
        expect(result.feeds).toEqual([{ symbol: "NASDAQ:QQQ", interval: "1D" }]);
        expect(result.intervals).toEqual([]);
        expect(result.diagnostics).toEqual([]);
    });

    it("resolves an input.interval default into the feed and the interval list", () => {
        const result = runFeeds(`
import { defineIndicator, input } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    inputs: { tf: input.interval("1D") },
    compute: ({ inputs, request }) => {
        request.security({ interval: inputs.tf });
    },
});
`);
        expect(result.feeds).toEqual([{ interval: "1D" }]);
        expect(result.intervals).toEqual(["1D"]);
        expect(result.diagnostics).toEqual([]);
    });

    it("sees through an `as` cast on an input-bound symbol + interval (converter emit)", () => {
        // The pine-converter emits an input-bound feed as `inputs.<name> as
        // string` (the `compute` context types `inputs` loosely), so the
        // extractor must unwrap the cast to resolve the default.
        const result = runFeeds(`
import { defineIndicator, input } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    inputs: { sym: input.symbol("NASDAQ:QQQ"), tf: input.interval("1D") },
    compute: ({ inputs, request }) => {
        request.security({ symbol: inputs.sym as string, interval: inputs.tf as string });
    },
});
`);
        expect(result.feeds).toEqual([{ symbol: "NASDAQ:QQQ", interval: "1D" }]);
        expect(result.diagnostics).toEqual([]);
    });

    it("sees through a parenthesized `as` cast on an input.enum symbol", () => {
        const result = runFeeds(`
import { defineIndicator, input } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    inputs: { sym: input.enum("AMEX:SPY", ["AMEX:SPY", "NASDAQ:QQQ"] as const) },
    compute: ({ inputs, request }) => {
        request.security({ symbol: (inputs.sym as string), interval: "1D" });
    },
});
`);
        expect(result.feeds).toEqual([
            { symbol: "AMEX:SPY", interval: "1D" },
            { symbol: "NASDAQ:QQQ", interval: "1D" },
        ]);
        expect(result.diagnostics).toEqual([]);
    });

    it("collapses a chart-symbol + chart-timeframe (empty default) onto the primary stream", () => {
        // `input.interval("")` is Pine's empty = chart timeframe; with the chart
        // symbol (omitted) it IS the primary stream — no secondary feed and no
        // higher-timeframe entry in the main-symbol projection.
        const result = runFeeds(`
import { defineIndicator, input } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    inputs: { tf: input.interval("") },
    compute: ({ inputs, request }) => {
        request.security({ interval: inputs.tf });
    },
});
`);
        expect(result.feeds).toEqual([]);
        expect(result.intervals).toEqual([]);
        expect(result.diagnostics).toEqual([]);
    });

    it("keeps a different-symbol + chart-timeframe (empty interval) feed", () => {
        // A present (different) symbol at the chart timeframe is a distinct feed
        // — a different instrument on the chart's own clock — keyed "<symbol>@".
        const result = runFeeds(`
import { defineIndicator, input } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    inputs: { sym: input.symbol("NASDAQ:QQQ"), tf: input.interval("") },
    compute: ({ inputs, request }) => {
        request.security({ symbol: inputs.sym, interval: inputs.tf });
    },
});
`);
        expect(result.feeds).toEqual([{ symbol: "NASDAQ:QQQ", interval: "" }]);
        expect(result.intervals).toEqual([]);
        expect(result.diagnostics).toEqual([]);
    });

    it("expands an input.enum symbol into one feed per option (cartesian with intervals)", () => {
        const result = runFeeds(`
import { defineIndicator, input } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    inputs: {
        sym: input.enum("AMEX:SPY", ["AMEX:SPY", "NASDAQ:QQQ"] as const),
        htf: input.enum("1D", ["1D", "1W"] as const),
    },
    compute: ({ inputs, request }) => {
        request.security({ symbol: inputs.sym, interval: inputs.htf });
    },
});
`);
        expect(result.feeds).toEqual([
            { symbol: "AMEX:SPY", interval: "1D" },
            { symbol: "AMEX:SPY", interval: "1W" },
            { symbol: "NASDAQ:QQQ", interval: "1D" },
            { symbol: "NASDAQ:QQQ", interval: "1W" },
        ]);
        expect(result.intervals).toEqual([]);
        expect(result.diagnostics).toEqual([]);
    });

    it("excludes a dynamic symbol and emits request-security-symbol-not-literal", () => {
        const result = runFeeds(`
import { defineIndicator, request } from "@invinite-org/chartlang-core";
declare const s: string;
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    compute: () => {
        request.security({ symbol: s, interval: "1D" });
    },
});
`);
        expect(result.feeds).toEqual([]);
        expect(result.intervals).toEqual([]);
        expect(result.diagnostics.map((d) => d.code)).toEqual([
            "request-security-symbol-not-literal",
        ]);
        expect(result.diagnostics[0]?.message).toBe(
            "request.security({ symbol }) must be a string literal, an input.symbol default, or an input.enum value",
        );
    });

    it("emits both diagnostics when symbol and interval are both dynamic", () => {
        const result = runFeeds(`
import { defineIndicator, request } from "@invinite-org/chartlang-core";
declare const s: string;
declare const tf: string;
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    compute: () => {
        request.security({ symbol: s, interval: tf });
    },
});
`);
        expect(result.feeds).toEqual([]);
        expect(result.intervals).toEqual([]);
        expect(result.diagnostics.map((d) => d.code).sort()).toEqual([
            "request-security-interval-not-literal",
            "request-security-symbol-not-literal",
        ]);
    });

    it("dedups the same symbol+interval requested by two callsites", () => {
        const result = runFeeds(`
import { defineIndicator, request } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    compute: () => {
        request.security({ symbol: "AMEX:SPY", interval: "1D" });
        request.security({ symbol: "AMEX:SPY", interval: "1D" });
    },
});
`);
        expect(result.feeds).toEqual([{ symbol: "AMEX:SPY", interval: "1D" }]);
    });

    it("sorts distinct symbols deterministically by feedKey", () => {
        const result = runFeeds(`
import { defineIndicator, request } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    compute: () => {
        request.security({ symbol: "NASDAQ:QQQ", interval: "1D" });
        request.security({ symbol: "AMEX:SPY", interval: "1D" });
        request.security({ interval: "1D" });
    },
});
`);
        // feedKey: "1D" (omitted) < "AMEX:SPY@1D" < "NASDAQ:QQQ@1D".
        expect(result.feeds).toEqual([
            { interval: "1D" },
            { symbol: "AMEX:SPY", interval: "1D" },
            { symbol: "NASDAQ:QQQ", interval: "1D" },
        ]);
        expect(result.intervals).toEqual(["1D"]);
    });

    it("rejects an inputs.symbol descriptor whose default is not a string", () => {
        // Manual caller path: a `symbol`-kind descriptor with a non-string
        // default cannot resolve, so it falls through to the dynamic diagnostic.
        const result = runFeedsWithInputs(
            `import { request } from "@invinite-org/chartlang-core";
request.security({ symbol: inputs.sym, interval: "1D" });`,
            { sym: { kind: "symbol", defaultValue: 1 } },
        );
        expect(result.feeds).toEqual([]);
        expect(result.diagnostics.map((d) => d.code)).toEqual([
            "request-security-symbol-not-literal",
        ]);
    });

    it("rejects an inputs reference that is neither enum nor symbol", () => {
        const result = runFeedsWithInputs(
            `import { request } from "@invinite-org/chartlang-core";
request.security({ symbol: inputs.sym, interval: "1D" });`,
            { sym: { kind: "string", defaultValue: "x" } },
        );
        expect(result.feeds).toEqual([]);
        expect(result.diagnostics.map((d) => d.code)).toEqual([
            "request-security-symbol-not-literal",
        ]);
    });

    it("rejects a missing inputs reference for the symbol opt", () => {
        const result = runFeedsWithInputs(
            `import { request } from "@invinite-org/chartlang-core";
request.security({ symbol: inputs.missing, interval: "1D" });`,
            {},
        );
        expect(result.feeds).toEqual([]);
        expect(result.diagnostics.map((d) => d.code)).toEqual([
            "request-security-symbol-not-literal",
        ]);
    });

    it("rejects a property-access symbol on a non-inputs identifier", () => {
        const result = runFeeds(`
import { defineIndicator, request } from "@invinite-org/chartlang-core";
declare const bar: { symbol: string };
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    compute: () => {
        request.security({ symbol: bar.symbol, interval: "1D" });
    },
});
`);
        expect(result.feeds).toEqual([]);
        expect(result.diagnostics.map((d) => d.code)).toEqual([
            "request-security-symbol-not-literal",
        ]);
    });

    it("rejects a symbol whose access base is not a bare identifier", () => {
        const result = runFeeds(`
import { defineIndicator, request } from "@invinite-org/chartlang-core";
declare const a: { b: { symbol: string } };
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    compute: () => {
        request.security({ symbol: a.b.symbol, interval: "1D" });
    },
});
`);
        expect(result.feeds).toEqual([]);
        expect(result.diagnostics.map((d) => d.code)).toEqual([
            "request-security-symbol-not-literal",
        ]);
    });

    it("produces no feeds when there are no request.security calls", () => {
        const result = runFeeds(`
import { defineIndicator, request } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "x",
    apiVersion: 1,
    compute: () => {
        request.lowerTf({ interval: "30s" });
    },
});
`);
        expect(result.feeds).toEqual([]);
        expect(result.intervals).toEqual(["30s"]);
    });
});
