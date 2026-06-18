// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { CallExpression, ExpressionNode } from "../ast/index.js";
import type { ConvertOpts, Diagnostic, SourceSpan } from "../index.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import type { DrawingCallSite, SemanticResult } from "../semantic/index.js";
import { analyze } from "../semantic/index.js";
import type { ResolvedAnchor } from "./coordinates.js";
import { resolveCoordinates } from "./coordinates.js";

const SPAN: SourceSpan = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 };

// Resolve the anchors for a Pine drawing call wrapped in a minimal script.
function resolveLine(
    call: string,
    opts: ConvertOpts = {},
): {
    anchors: ResolvedAnchor[];
    diagnostics: readonly Diagnostic[];
} {
    const src = `//@version=6\nindicator("t")\nvar line ln = na\nln := ${call}\n`;
    const result = analyze(parseStatements(lex(src).tokens).script);
    const resolution = resolveCoordinates(result, opts);
    return { anchors: [...resolution.anchors.values()], diagnostics: resolution.diagnostics };
}

function hasCode(diagnostics: readonly Diagnostic[], suffix: string): boolean {
    return diagnostics.some((d) => d.code === `pine-converter/transform/${suffix}`);
}

describe("resolveCoordinates — bar_index anchors", () => {
    it("resolves the acceptance fixture: one historical + one future anchor", () => {
        const { anchors, diagnostics } = resolveLine(
            "line.new(bar_index, close, bar_index + 10, close)",
            { barInterval: 60_000 },
        );
        expect(anchors).toEqual([
            { kind: "bar-index-historical", offsetExpr: "0", priceExpr: "bar.close" },
            {
                kind: "bar-index-future",
                offsetExpr: "10",
                priceExpr: "bar.close",
                requiresBarInterval: true,
            },
        ]);
        expect(diagnostics).toEqual([]);
    });

    it("emits requires-bar-interval when a future anchor has no barInterval", () => {
        const { diagnostics } = resolveLine("line.new(bar_index, close, bar_index + 10, close)", {
            barInterval: null,
        });
        expect(hasCode(diagnostics, "requires-bar-interval")).toBe(true);
    });

    it("emits requires-bar-interval when barInterval is omitted entirely", () => {
        const { diagnostics } = resolveLine("line.new(bar_index, close, bar_index + 5, close)");
        expect(hasCode(diagnostics, "requires-bar-interval")).toBe(true);
    });

    it("resolves bar_index[N] to a historical offset N", () => {
        const { anchors } = resolveLine("line.new(bar_index[3], close, bar_index, close)");
        expect(anchors[0]).toEqual({
            kind: "bar-index-historical",
            offsetExpr: "3",
            priceExpr: "bar.close",
        });
    });

    it("resolves bar_index - N to a historical offset N", () => {
        const { anchors } = resolveLine("line.new(bar_index - 4, close, bar_index, close)");
        expect(anchors[0]).toEqual({
            kind: "bar-index-historical",
            offsetExpr: "4",
            priceExpr: "bar.close",
        });
    });

    it("unwraps parens around the x expression", () => {
        const { anchors } = resolveLine("line.new((bar_index), close, bar_index, close)");
        expect(anchors[0]).toEqual({
            kind: "bar-index-historical",
            offsetExpr: "0",
            priceExpr: "bar.close",
        });
    });

    it("warns + treats bar_index + <non-literal> as a dynamic future anchor", () => {
        const { anchors, diagnostics } = resolveLine(
            "line.new(bar_index + offset, close, bar_index, close)",
            { barInterval: 60_000 },
        );
        expect(anchors[0]).toEqual({
            kind: "bar-index-future",
            offsetExpr: "offset",
            priceExpr: "bar.close",
            requiresBarInterval: true,
        });
        expect(hasCode(diagnostics, "dynamic-bar-index")).toBe(true);
    });

    it("does NOT raise requires-bar-interval for a dynamic + offset with no barInterval", () => {
        // A dynamic `bar_index + <non-literal>` offset (e.g. the lowering of
        // `bar_index + ta.highestbars(...)`, whose runtime value is ≤ 0) is
        // resolved sign-agnostically by `bar.point` at runtime — a negative
        // offset resolves to the historical timestamp via the time buffer, so
        // no `opts.barInterval` is required. Only the LITERAL `bar_index + N`
        // future case still raises `requires-bar-interval`.
        const { anchors, diagnostics } = resolveLine(
            "line.new(bar_index + hbar, close, bar_index, close)",
            { barInterval: null },
        );
        expect(anchors[0]).toEqual({
            kind: "bar-index-future",
            offsetExpr: "hbar",
            priceExpr: "bar.close",
            requiresBarInterval: true,
        });
        expect(hasCode(diagnostics, "dynamic-bar-index")).toBe(true);
        expect(hasCode(diagnostics, "requires-bar-interval")).toBe(false);
    });

    it("warns + treats bar_index - <non-literal> as a dynamic historical anchor", () => {
        const { anchors, diagnostics } = resolveLine(
            "line.new(bar_index - offset, close, bar_index, close)",
        );
        expect(anchors[0]).toEqual({
            kind: "bar-index-historical",
            offsetExpr: "offset",
            priceExpr: "bar.close",
        });
        expect(hasCode(diagnostics, "dynamic-bar-index")).toBe(true);
    });

    it("falls back with a warning for a non-additive bar_index expression", () => {
        const { anchors, diagnostics } = resolveLine(
            "line.new(bar_index * 2, close, bar_index, close)",
        );
        expect(anchors[0]).toEqual({
            kind: "bar-index-historical",
            offsetExpr: "0",
            priceExpr: "bar.close",
        });
        expect(hasCode(diagnostics, "unresolved-bar-index")).toBe(true);
    });

    it("ignores a non-positive literal offset and falls back to dynamic", () => {
        const { anchors, diagnostics } = resolveLine(
            "line.new(bar_index + 0, close, bar_index, close)",
            { barInterval: 1 },
        );
        expect(anchors[0]).toEqual({
            kind: "bar-index-future",
            offsetExpr: "0",
            priceExpr: "bar.close",
            requiresBarInterval: true,
        });
        expect(hasCode(diagnostics, "dynamic-bar-index")).toBe(true);
    });

    it("falls back with a warning for an unrelated identifier x", () => {
        const { anchors, diagnostics } = resolveLine("line.new(myX, close, bar_index, close)");
        expect(anchors[0]).toEqual({
            kind: "bar-index-historical",
            offsetExpr: "0",
            priceExpr: "bar.close",
        });
        expect(hasCode(diagnostics, "unresolved-bar-index")).toBe(true);
    });

    it("falls back when bar_index[N] has a non-literal offset", () => {
        const { anchors, diagnostics } = resolveLine(
            "line.new(bar_index[k], close, bar_index, close)",
        );
        expect(anchors[0]).toEqual({
            kind: "bar-index-historical",
            offsetExpr: "0",
            priceExpr: "bar.close",
        });
        expect(hasCode(diagnostics, "unresolved-bar-index")).toBe(true);
    });

    it("treats a non-xloc-member-access xloc value as the default bar_index mode", () => {
        const { anchors } = resolveLine(
            "line.new(bar_index, close, bar_index, close, xloc = someVar)",
        );
        expect(anchors[0]?.kind).toBe("bar-index-historical");
    });
});

describe("resolveCoordinates — bar_time anchors", () => {
    it("passes a bar_time x expression through as bar-time-direct", () => {
        const { anchors } = resolveLine("line.new(time, close, time, close, xloc = xloc.bar_time)");
        expect(anchors[0]).toEqual({
            kind: "bar-time-direct",
            timeExpr: "bar.time",
            priceExpr: "bar.close",
        });
    });

    it("computes a literal-world-point when both coords are literals under bar_time", () => {
        const { anchors } = resolveLine(
            "line.new(1700000000000, 100.5, 1700000000000, 110, xloc = xloc.bar_time)",
        );
        expect(anchors[0]).toEqual({
            kind: "literal-world-point",
            time: 1_700_000_000_000,
            price: 100.5,
        });
    });

    it("computes a literal-world-point with a negative-literal price", () => {
        const { anchors } = resolveLine(
            "line.new(1700000000000, -5, 1700000000000, 110, xloc = xloc.bar_time)",
        );
        expect(anchors[0]).toEqual({
            kind: "literal-world-point",
            time: 1_700_000_000_000,
            price: -5,
        });
    });

    it("computes a literal-world-point with a positive-prefixed literal price", () => {
        const { anchors } = resolveLine(
            "line.new(1700000000000, +5, 1700000000000, 110, xloc = xloc.bar_time)",
        );
        expect(anchors[0]).toEqual({
            kind: "literal-world-point",
            time: 1_700_000_000_000,
            price: 5,
        });
    });
});

describe("resolveCoordinates — chart.point factories", () => {
    it("resolves chart.point.now", () => {
        const { anchors } = resolveLine("line.new(chart.point.now(close), na, bar_index, close)");
        expect(anchors[0]).toEqual({ kind: "chart-point-now", priceExpr: "bar.close" });
    });

    it("resolves chart.point.from_index", () => {
        const { anchors } = resolveLine(
            "line.new(chart.point.from_index(5, close), na, bar_index, close)",
        );
        expect(anchors[0]).toEqual({
            kind: "chart-point-from-index",
            offsetExpr: "5",
            priceExpr: "bar.close",
        });
    });

    it("resolves chart.point.from_time", () => {
        const { anchors } = resolveLine(
            "line.new(chart.point.from_time(time, close), na, bar_index, close)",
        );
        expect(anchors[0]).toEqual({
            kind: "chart-point-from-time",
            timeExpr: "bar.time",
            priceExpr: "bar.close",
        });
    });

    it("resolves chart.point.new", () => {
        const { anchors } = resolveLine(
            "line.new(chart.point.new(time, 3, close), na, bar_index, close)",
        );
        expect(anchors[0]).toEqual({
            kind: "chart-point-new",
            timeExpr: "bar.time",
            offsetExpr: "3",
            priceExpr: "bar.close",
        });
    });
});

// Hand-built SemanticResult helpers exercise the layout-skip and
// missing-argument branches that a real Pine drawing script cannot express.
function blankResult(sites: readonly DrawingCallSite[]): SemanticResult {
    return {
        script: { kind: "script", version: null, declaration: null, body: [], span: SPAN },
        rootScope: { parent: null, symbols: new Map(), span: SPAN },
        scopes: new Map(),
        annotations: new Map(),
        symbols: new Map(),
        lifetimes: new Map(),
        drawingSites: sites,
        drawingClassifications: new Map(),
        referencesBarIndex: false,
        referencesFutureBarIndex: false,
        diagnostics: [],
    };
}

function site(ctor: DrawingCallSite["constructor"], args: CallExpression["args"]): DrawingCallSite {
    const call: CallExpression = {
        kind: "call-expression",
        callee: { kind: "member-access-expression", head: null, chain: [ctor], span: SPAN },
        args,
        span: SPAN,
    };
    return {
        call,
        constructor: ctor,
        handleType: "line",
        camp: { kind: "camp-c-unbounded", reasoning: "x" },
        span: SPAN,
    };
}

const lit = (v: string): ExpressionNode => ({
    kind: "literal-expression",
    literalKind: "int",
    value: v,
    span: SPAN,
});

// A line.new whose first x argument is the given chart.point factory call,
// built directly so missing-argument and malformed-callee branches can be
// exercised without a Pine source that the parser would reject.
function chartPointCall(callee: ExpressionNode, args: CallExpression["args"]): ExpressionNode {
    return { kind: "call-expression", callee, args, span: SPAN };
}

function lineSiteWithFirstX(xValue: ExpressionNode): DrawingCallSite {
    return site("line.new", [
        { name: null, value: xValue, span: SPAN },
        { name: null, value: lit("0"), span: SPAN },
        { name: null, value: lit("0"), span: SPAN },
        { name: null, value: lit("0"), span: SPAN },
    ]);
}

const chartPointCallee = (factory: string): ExpressionNode => ({
    kind: "member-access-expression",
    head: null,
    chain: ["chart", "point", factory],
    span: SPAN,
});

describe("resolveCoordinates — chart.point edge cases", () => {
    it("treats a non-call x as a normal coordinate, not a chart.point", () => {
        // A member-access x that is not a call falls through to bar_index handling.
        const result = blankResult([
            lineSiteWithFirstX({
                kind: "member-access-expression",
                head: null,
                chain: ["foo"],
                span: SPAN,
            }),
        ]);
        const anchors = [...resolveCoordinates(result).anchors.values()];
        expect(anchors[0]?.kind).toBe("bar-index-historical");
    });

    it("ignores a call whose callee is not a bare-rooted member chain", () => {
        const result = blankResult([lineSiteWithFirstX(chartPointCall(lit("0"), []))]);
        const anchors = [...resolveCoordinates(result).anchors.values()];
        expect(anchors[0]?.kind).toBe("bar-index-historical");
    });

    it("ignores a call whose member chain is not chart.point.*", () => {
        const result = blankResult([
            lineSiteWithFirstX(
                chartPointCall(
                    {
                        kind: "member-access-expression",
                        head: null,
                        chain: ["ta", "ema"],
                        span: SPAN,
                    },
                    [],
                ),
            ),
        ]);
        const anchors = [...resolveCoordinates(result).anchors.values()];
        expect(anchors[0]?.kind).toBe("bar-index-historical");
    });

    it("ignores a bare chart.point member chain with no factory segment", () => {
        const result = blankResult([
            lineSiteWithFirstX(
                chartPointCall(
                    {
                        kind: "member-access-expression",
                        head: null,
                        chain: ["chart", "point"],
                        span: SPAN,
                    },
                    [],
                ),
            ),
        ]);
        const anchors = [...resolveCoordinates(result).anchors.values()];
        expect(anchors[0]?.kind).toBe("bar-index-historical");
    });

    it("ignores a chart.point call with a computed receiver head", () => {
        const result = blankResult([
            lineSiteWithFirstX(
                chartPointCall(
                    {
                        kind: "member-access-expression",
                        head: lit("0"),
                        chain: ["point", "now"],
                        span: SPAN,
                    },
                    [],
                ),
            ),
        ]);
        const anchors = [...resolveCoordinates(result).anchors.values()];
        expect(anchors[0]?.kind).toBe("bar-index-historical");
    });

    it("defaults each chart.point factory argument when absent", () => {
        const cases: ReadonlyArray<readonly [string, ResolvedAnchor]> = [
            ["now", { kind: "chart-point-now", priceExpr: "Number.NaN" }],
            [
                "from_index",
                { kind: "chart-point-from-index", offsetExpr: "0", priceExpr: "Number.NaN" },
            ],
            [
                "from_time",
                { kind: "chart-point-from-time", timeExpr: "Number.NaN", priceExpr: "Number.NaN" },
            ],
            [
                "new",
                {
                    kind: "chart-point-new",
                    timeExpr: "Number.NaN",
                    offsetExpr: "0",
                    priceExpr: "Number.NaN",
                },
            ],
        ];
        for (const [factory, expected] of cases) {
            const result = blankResult([
                lineSiteWithFirstX(chartPointCall(chartPointCallee(factory), [])),
            ]);
            const anchors = [...resolveCoordinates(result).anchors.values()];
            expect(anchors[0]).toEqual(expected);
        }
    });
});

describe("resolveCoordinates — structural edge cases", () => {
    it("skips constructors with no coordinate layout (table/linefill/polyline)", () => {
        const result = blankResult([
            site("table.new", []),
            site("linefill.new", []),
            site("polyline.new", []),
        ]);
        expect(resolveCoordinates(result).anchors.size).toBe(0);
    });

    it("skips a coordinate pair whose positional args are missing", () => {
        // line.new with only one positional arg — the (0,1) pair has no y.
        const result = blankResult([
            site("line.new", [{ name: null, value: lit("0"), span: SPAN }]),
        ]);
        expect(resolveCoordinates(result).anchors.size).toBe(0);
    });

    it("defaults opts to an empty object", () => {
        expect(resolveCoordinates(blankResult([])).diagnostics).toEqual([]);
    });
});
