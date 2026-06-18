// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { CallExpression } from "../ast/index.js";
import type { Declaration } from "../ast/script.js";
import { lex } from "../lexer/index.js";
import type { PineDrawingConstructor } from "../mapping/index.js";
import { parseStatements } from "../parser/index.js";
import { analyze } from "../semantic/index.js";
import type { DrawingCallSite, HandleType, SemanticResult, SymbolInfo } from "../semantic/index.js";
import { transformCampC } from "./campC.js";
import { tryHeuristics } from "./campCHeuristics.js";
import { CAMP_C_REJECTS, rejectSuggestion } from "./campCRejects.js";
import { transformDeclaration } from "./declaration.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import type { ScriptScaffold } from "./ir.js";

type ConvertibleDecl = Extract<
    Declaration,
    { kind: "indicator-declaration" | "strategy-declaration" }
>;

const SPAN = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 } as const;

function setup(src: string): {
    scaffold: ScriptScaffold;
    diagnostics: DiagnosticCollector;
    analysis: SemanticResult;
} {
    const analysis = analyze(parseStatements(lex(src).tokens).script);
    const decl = analysis.script.declaration as ConvertibleDecl;
    const diagnostics = new DiagnosticCollector();
    const scaffold = transformDeclaration(decl, analysis, diagnostics);
    return { scaffold, diagnostics, analysis };
}

function symbol(name: string, handleType: HandleType): SymbolInfo {
    return {
        name,
        kind: "var-variable",
        declarationSpan: SPAN,
        typeAnnotation: null,
        qualifier: "series",
        handleType,
    };
}

function syntheticCall(chain: readonly string[]): CallExpression {
    return {
        kind: "call-expression",
        callee: { kind: "member-access-expression", head: null, chain, span: SPAN },
        args: [],
        span: SPAN,
    };
}

// The real `.new()` call node the analysis classified for the given
// constructor, so a synthetic site can carry the identity the push-site scan
// matches on.
function realDrawSite(analysis: SemanticResult, ctor: PineDrawingConstructor): DrawingCallSite {
    const site = analysis.drawingSites.find((s) => s.constructor === ctor);
    if (site === undefined) {
        throw new Error(`no ${ctor} site in fixture`);
    }
    return site;
}

function forceUnbounded(site: DrawingCallSite, reasoning: string): DrawingCallSite {
    return { ...site, camp: { kind: "camp-c-unbounded", reasoning } };
}

describe("transformCampC — defensive early return", () => {
    it("does nothing for a non-camp-c site", () => {
        const { scaffold, diagnostics, analysis } = setup(
            '//@version=6\nindicator("X", overlay=true)\nplot(close)\n',
        );
        const site: DrawingCallSite = {
            call: syntheticCall(["line", "new"]),
            constructor: "line.new",
            handleType: "line",
            camp: { kind: "camp-a", handleSymbol: symbol("lvl", "line") },
            span: SPAN,
        };
        transformCampC(site, analysis, scaffold, diagnostics);
        expect(diagnostics.size).toBe(0);
        expect(scaffold.computeBody.statements).toHaveLength(0);
    });
});

describe("transformCampC — H2 loop-bound fold (synthetic camp)", () => {
    // The classifier routes a root-resolved looped push to camp-b; force the
    // site to camp-c-unbounded to exercise H2's fold path directly.
    const SRC = [
        "//@version=6",
        'indicator("X", overlay=true)',
        "var lvls = array.new_line()",
        "for i = 0 to 4",
        "    array.push(lvls, line.new(bar_index, close, bar_index, close))",
        "plot(close)",
    ].join("\n");

    it("folds to a ring whose cap is the literal loop bound", () => {
        const { scaffold, diagnostics, analysis } = setup(SRC);
        const site = forceUnbounded(realDrawSite(analysis, "line.new"), "forced");
        transformCampC(site, analysis, scaffold, diagnostics);
        expect(scaffold.handleRings).toEqual([{ name: "lvls", kind: "line", cap: 5 }]);
        const applied = diagnostics
            .toArray()
            .find((d) => d.code.endsWith("camp-c-heuristic-applied"));
        expect(applied?.message).toContain("loop-bound K=5");
    });
});

describe("transformCampC — H2 input.int and bare-`to` bounds", () => {
    it("recovers a bare `to L` bound (no `- 1`) and an input.int bound", () => {
        const src = [
            "//@version=6",
            'indicator("X", overlay=true)',
            "var lvls = array.new_line()",
            "for i = 0 to input.int(7)",
            "    array.push(lvls, line.new(bar_index, close, bar_index, close))",
            "plot(close)",
        ].join("\n");
        const { scaffold, diagnostics, analysis } = setup(src);
        const site = forceUnbounded(realDrawSite(analysis, "line.new"), "forced");
        const result = tryHeuristics(site, analysis, scaffold);
        expect(result?.cap).toBe(8);
        void diagnostics;
    });
});

describe("transformCampC — H3 single-use fold (synthetic camp)", () => {
    it("folds to a ring whose cap is the straight-line push count", () => {
        const src = [
            "//@version=6",
            'indicator("X", overlay=true)',
            "var pts = array.new_line()",
            "array.push(pts, line.new(bar_index, close, bar_index, close))",
            "array.push(pts, line.new(bar_index, open, bar_index, open))",
            "plot(close)",
        ].join("\n");
        const { scaffold, diagnostics, analysis } = setup(src);
        // The first `.new()` site, forced unbounded so neither H1 (no cap) nor
        // H2 (no loop) fires — only H3 (two straight-line pushes) remains.
        const site = forceUnbounded(realDrawSite(analysis, "line.new"), "forced");
        transformCampC(site, analysis, scaffold, diagnostics);
        const applied = diagnostics
            .toArray()
            .find((d) => d.code.endsWith("camp-c-heuristic-applied"));
        expect(applied?.message).toContain("single-use straight-line push of N=2");
    });
});

describe("transformCampC — heuristic returns null without a push site", () => {
    it("rejects when the forced site has no array.push (no collection name)", () => {
        const { scaffold, diagnostics, analysis } = setup(
            '//@version=6\nindicator("X", overlay=true)\nplot(close)\n',
        );
        const site: DrawingCallSite = {
            call: syntheticCall(["line", "new"]),
            constructor: "line.new",
            handleType: "line",
            camp: { kind: "camp-c-unbounded", reasoning: "no push" },
            span: SPAN,
        };
        transformCampC(site, analysis, scaffold, diagnostics);
        expect(diagnostics.toArray()).toHaveLength(1);
        expect(diagnostics.toArray()[0].code).toBe(
            "pine-converter/semantic/unbounded-handle-collection",
        );
    });
});

describe("transformCampC — fold fails when collection is unresolved at root", () => {
    it("falls through to a reject when the heuristic cap is found but the symbol is nested", () => {
        // Push collection declared only inside the `if`, so H1 finds the cap
        // (indicator max_lines_count) and the push name, but the collection
        // does not resolve at the root scope → fold returns false → reject.
        const { scaffold, diagnostics, analysis } = setup(
            [
                "//@version=6",
                'indicator("X", overlay=true, max_lines_count=30)',
                "if close > open",
                "    var lvls = array.new_line()",
                "    array.push(lvls, line.new(bar_index, close, bar_index, close))",
                "plot(close)",
            ].join("\n"),
        );
        const site = forceUnbounded(realDrawSite(analysis, "line.new"), "no detectable cap");
        transformCampC(site, analysis, scaffold, diagnostics);
        expect(scaffold.handleRings).toEqual([]);
        const reject = diagnostics
            .toArray()
            .find((d) => d.code === "pine-converter/semantic/unbounded-handle-collection");
        expect(reject).toBeDefined();
    });
});

describe("transformCampC — reject classification by reasoning + shape", () => {
    function rejectCodeFor(site: DrawingCallSite, analysis: SemanticResult): string {
        const { scaffold, diagnostics } = setup(
            '//@version=6\nindicator("X", overlay=true)\nplot(close)\n',
        );
        transformCampC(site, analysis, scaffold, diagnostics);
        const reject = diagnostics.toArray().at(-1);
        if (reject === undefined) {
            throw new Error("expected a reject");
        }
        return reject.code;
    }

    function baseSite(
        analysis: SemanticResult,
        ctor: PineDrawingConstructor,
        handleType: HandleType,
        reasoning: string,
    ): DrawingCallSite {
        return {
            call: syntheticCall(ctor.split(".")),
            constructor: ctor,
            handleType,
            camp: { kind: "camp-c-unbounded", reasoning },
            span: SPAN,
        };
    }

    it("early-returns on a polyline site (Task 14 owns polyline)", () => {
        // `transformPolylineLinefill` (Task 14) owns ALL `polyline.new` sites,
        // so Camp C no longer rejects them — it early-returns with no
        // diagnostic and no compute statement.
        const { scaffold, diagnostics, analysis } = setup(
            '//@version=6\nindicator("X", overlay=true)\nplot(close)\n',
        );
        transformCampC(
            baseSite(analysis, "polyline.new", "polyline", "no cap"),
            analysis,
            scaffold,
            diagnostics,
        );
        expect(diagnostics.size).toBe(0);
        expect(scaffold.computeBody.statements).toHaveLength(0);
    });

    it("early-returns on a static (non-array.get) linefill site (Task 14 owns it)", () => {
        const { scaffold, diagnostics, analysis } = setup(
            '//@version=6\nindicator("X", overlay=true)\nplot(close)\n',
        );
        transformCampC(
            baseSite(analysis, "linefill.new", "linefill", "static two-line"),
            analysis,
            scaffold,
            diagnostics,
        );
        expect(diagnostics.size).toBe(0);
        expect(scaffold.computeBody.statements).toHaveLength(0);
    });

    it("classifies a `.all` reasoning as for-in-line-all", () => {
        const { analysis } = setup('//@version=6\nindicator("X", overlay=true)\nplot(close)\n');
        const code = rejectCodeFor(
            baseSite(analysis, "line.new", "line", "iterates line.all"),
            analysis,
        );
        expect(code).toBe("pine-converter/transform/for-in-line-all");
    });

    it("classifies a UDT reasoning as handle-store-in-udt", () => {
        const { analysis } = setup('//@version=6\nindicator("X", overlay=true)\nplot(close)\n');
        const code = rejectCodeFor(
            baseSite(analysis, "line.new", "line", "stored in a user-defined type"),
            analysis,
        );
        expect(code).toBe("pine-converter/transform/handle-store-in-udt");
    });

    it("classifies a dynamic-index reasoning as dynamic-handle-index", () => {
        const { analysis } = setup('//@version=6\nindicator("X", overlay=true)\nplot(close)\n');
        const code = rejectCodeFor(
            baseSite(analysis, "line.new", "line", "dynamic index addressing"),
            analysis,
        );
        expect(code).toBe("pine-converter/transform/dynamic-handle-index");
    });

    it("classifies a `*.copy(handle)` script as handle-copy", () => {
        const src = [
            "//@version=6",
            'indicator("X", overlay=true)',
            "ln2 = line.copy(ln)",
            "plot(close)",
        ].join("\n");
        const { scaffold, diagnostics, analysis } = setup(src);
        const site = baseSite(analysis, "line.new", "line", "no cap");
        transformCampC(site, analysis, scaffold, diagnostics);
        const reject = diagnostics.toArray().at(-1);
        expect(reject?.code).toBe("pine-converter/transform/handle-copy");
    });
});

describe("tryHeuristics — H1 null paths", () => {
    it("returns null when the camp-c-bounded site has no push collection", () => {
        const { scaffold, analysis } = setup(
            '//@version=6\nindicator("X", overlay=true, max_lines_count=30)\nplot(close)\n',
        );
        const site: DrawingCallSite = {
            call: syntheticCall(["line", "new"]),
            constructor: "line.new",
            handleType: "line",
            camp: { kind: "camp-c-bounded", reasoning: "bounded by indicator cap=30" },
            span: SPAN,
        };
        expect(tryHeuristics(site, analysis, scaffold)).toBeNull();
    });

    it("returns null for a handle family with no maxDrawings field (table)", () => {
        // The table push lives inside an `if` (not top-level), so H3's
        // straight-line scan misses it and there is no loop for H2 — leaving
        // only H1, which returns null because `table` maps to no maxDrawings
        // field.
        const src = [
            "//@version=6",
            'indicator("X", overlay=true, max_lines_count=30)',
            "var tbls = array.new<table>()",
            "if close > open",
            "    array.push(tbls, table.new(position.top_right, 1, 1))",
            "plot(close)",
        ].join("\n");
        const { scaffold, analysis } = setup(src);
        const site: DrawingCallSite = {
            ...realDrawSite(analysis, "table.new"),
            camp: { kind: "camp-c-bounded", reasoning: "bounded by indicator cap=30" },
        };
        expect(tryHeuristics(site, analysis, scaffold)).toBeNull();
    });

    it("returns null when the scaffold carries no cap for the family", () => {
        // A synthetic scaffold whose `maxDrawings` is empty exercises H1's
        // `cap === undefined` guard (a real Task-8 scaffold defaults every
        // bucket to 50, so this guard is otherwise defensive).
        const src = [
            "//@version=6",
            'indicator("X", overlay=true)',
            "if close > open",
            "    array.push(lvls, line.new(bar_index, close, bar_index, close))",
            "plot(close)",
        ].join("\n");
        const { scaffold, analysis } = setup(src);
        const stripped: ScriptScaffold = { ...scaffold, maxDrawings: {} };
        const site: DrawingCallSite = {
            call: realDrawSite(analysis, "line.new").call,
            constructor: "line.new",
            handleType: "line",
            camp: { kind: "camp-c-bounded", reasoning: "bounded by indicator cap=30" },
            span: SPAN,
        };
        // Push is nested → H3 misses it; no loop → H2 misses; H1 hits the
        // undefined-cap guard → all null.
        expect(tryHeuristics(site, analysis, stripped)).toBeNull();
    });
});

describe("tryHeuristics — H2 loop-bound edge cases", () => {
    it("recovers a bound from a push nested under an `if` inside the loop", () => {
        const src = [
            "//@version=6",
            'indicator("X", overlay=true)',
            "var lvls = array.new_line()",
            "for i = 0 to 9",
            "    if close > open",
            "        array.push(lvls, line.new(bar_index, close, bar_index, close))",
            "plot(close)",
        ].join("\n");
        const { scaffold, analysis } = setup(src);
        const site = forceUnbounded(realDrawSite(analysis, "line.new"), "forced");
        expect(tryHeuristics(site, analysis, scaffold)?.cap).toBe(10);
    });

    it("does not match a loop whose body never pushes the site", () => {
        const src = [
            "//@version=6",
            'indicator("X", overlay=true)',
            "var lvls = array.new_line()",
            "for i = 0 to 9",
            "    x = close",
            "array.push(lvls, line.new(bar_index, close, bar_index, close))",
            "plot(close)",
        ].join("\n");
        const { scaffold, analysis } = setup(src);
        const site = forceUnbounded(realDrawSite(analysis, "line.new"), "forced");
        // No loop pushes the site → H2 null; H3's straight-line count (1) wins.
        const result = tryHeuristics(site, analysis, scaffold);
        expect(result?.reasoning).toContain("single-use straight-line push of N=1");
    });

    it("returns null for a non-literal `to L - 1` bound (falls to H3)", () => {
        const src = [
            "//@version=6",
            'indicator("X", overlay=true)',
            "var lvls = array.new_line()",
            "for i = 0 to n - 1",
            "    array.push(lvls, line.new(bar_index, close, bar_index, close))",
            "plot(close)",
        ].join("\n");
        const { scaffold, analysis } = setup(src);
        const site = forceUnbounded(realDrawSite(analysis, "line.new"), "forced");
        // The for-bound is non-literal; there is no top-level push, so H3 also
        // finds zero straight-line pushes → no heuristic.
        expect(tryHeuristics(site, analysis, scaffold)).toBeNull();
    });
});

describe("transformCampC — fold returns false for a ghost collection", () => {
    it("rejects when a heuristic names a collection absent from the root scope", () => {
        const src = [
            "//@version=6",
            'indicator("X", overlay=true)',
            "array.push(ghost, line.new(bar_index, close, bar_index, close))",
            "plot(close)",
        ].join("\n");
        const { scaffold, diagnostics, analysis } = setup(src);
        const site = forceUnbounded(realDrawSite(analysis, "line.new"), "no detectable cap");
        // H3 finds the top-level push (collection "ghost"), but "ghost" was
        // never declared at root → foldIntoRing returns false → reject.
        transformCampC(site, analysis, scaffold, diagnostics);
        expect(scaffold.handleRings).toEqual([]);
        const reject = diagnostics
            .toArray()
            .find((d) => d.code === "pine-converter/semantic/unbounded-handle-collection");
        expect(reject).toBeDefined();
    });
});

describe("transformCampC — handle-copy in a var-declaration", () => {
    it("classifies a `var line ln2 = line.copy(ln)` script as handle-copy", () => {
        const src = [
            "//@version=6",
            'indicator("X", overlay=true)',
            "var line ln2 = line.copy(ln)",
            "plot(close)",
        ].join("\n");
        const { scaffold, diagnostics, analysis } = setup(src);
        const site: DrawingCallSite = {
            call: syntheticCall(["line", "new"]),
            constructor: "line.new",
            handleType: "line",
            camp: { kind: "camp-c-unbounded", reasoning: "no cap" },
            span: SPAN,
        };
        transformCampC(site, analysis, scaffold, diagnostics);
        expect(diagnostics.toArray().at(-1)?.code).toBe("pine-converter/transform/handle-copy");
    });
});

describe("tryHeuristics — bound + flatten coverage", () => {
    function loopFixture(toExpr: string): { scaffold: ScriptScaffold; analysis: SemanticResult } {
        const src = [
            "//@version=6",
            'indicator("X", overlay=true)',
            "var lvls = array.new_line()",
            `for i = 0 to ${toExpr}`,
            "    array.push(lvls, line.new(bar_index, close, bar_index, close))",
            "plot(close)",
        ].join("\n");
        const { scaffold, analysis } = setup(src);
        return { scaffold, analysis };
    }

    function capFor(toExpr: string): number | null {
        const { scaffold, analysis } = loopFixture(toExpr);
        const site = forceUnbounded(realDrawSite(analysis, "line.new"), "forced");
        return tryHeuristics(site, analysis, scaffold)?.cap ?? null;
    }

    it("recovers a `to L - 1` literal-minus-literal bound", () => {
        expect(capFor("9 - 1")).toBe(9);
    });

    it("recovers a unary `+` literal bound", () => {
        expect(capFor("+6")).toBe(7);
    });

    it("returns null for a `to L - 1` bound whose left side is non-literal", () => {
        // `n - 1` → left (`n`) non-literal → loopUpperBound null → H2 null;
        // no top-level push → H3 null too.
        expect(capFor("n - 1")).toBeNull();
    });

    it("returns null for a non-positive unary `-` literal bound", () => {
        // `-1` → unary minus literal → loopUpperBound 0 → bound <= 0 → null.
        expect(capFor("-1")).toBeNull();
    });

    it("returns null for an `input.int()` bound with no default", () => {
        expect(capFor("input.int()")).toBeNull();
    });

    it("returns null for a bare non-literal `to` bound", () => {
        expect(capFor("len")).toBeNull();
    });

    it("finds a push collection inside an `else` branch (flatten recursion)", () => {
        const src = [
            "//@version=6",
            'indicator("X", overlay=true, max_lines_count=40)',
            "var lvls = array.new_line()",
            "if close > open",
            "    x = 1",
            "else if close < open",
            "    y = 2",
            "else",
            "    array.push(lvls, line.new(bar_index, close, bar_index, close))",
            "plot(close)",
        ].join("\n");
        const { scaffold, analysis } = setup(src);
        const site: DrawingCallSite = {
            ...realDrawSite(analysis, "line.new"),
            camp: { kind: "camp-c-bounded", reasoning: "bounded by indicator cap=40" },
        };
        expect(tryHeuristics(site, analysis, scaffold)?.collectionName).toBe("lvls");
    });
});

describe("tryHeuristics — malformed array.push args", () => {
    it("ignores a one-arg `array.push(coll)` (no pushed value to match the site)", () => {
        const src = [
            "//@version=6",
            'indicator("X", overlay=true)',
            "var lvls = array.new_line()",
            "array.push(lvls)",
            "plot(close)",
        ].join("\n");
        const { scaffold, analysis } = setup(src);
        const site: DrawingCallSite = {
            call: syntheticCall(["line", "new"]),
            constructor: "line.new",
            handleType: "line",
            camp: { kind: "camp-c-unbounded", reasoning: "x" },
            span: SPAN,
        };
        // The push's 2nd arg is absent, so it never matches the site's call.
        expect(tryHeuristics(site, analysis, scaffold)).toBeNull();
    });

    it("skips a zero-arg `array.push()` while counting straight-line pushes", () => {
        // H3 counts straight-line pushes over `coll`; a stray zero-arg
        // `array.push()` has no collection identifier and is skipped
        // (exercising `identifierName(undefined)`).
        const src = [
            "//@version=6",
            'indicator("X", overlay=true)',
            "var coll = array.new_line()",
            "array.push(coll, line.new(bar_index, close, bar_index, close))",
            "array.push()",
            "plot(close)",
        ].join("\n");
        const { scaffold, analysis } = setup(src);
        const site = forceUnbounded(realDrawSite(analysis, "line.new"), "forced");
        const result = tryHeuristics(site, analysis, scaffold);
        // Only the one real push over `coll` counts → single-use N=1.
        expect(result?.reasoning).toContain("single-use straight-line push of N=1");
    });
});

describe("transformCampC — camp-c-bounded that cannot fold", () => {
    it("rejects with an empty-reasoning classification when the collection is nested", () => {
        // camp-c-bounded site whose collection lives only inside the `if`.
        // H1 finds the cap + push name but the collection is not at root →
        // foldIntoRing false → classifyReject runs with the camp-c-bounded
        // (empty-reasoning) arm of line 87.
        const src = [
            "//@version=6",
            'indicator("X", overlay=true, max_lines_count=30)',
            "if close > open",
            "    var lvls = array.new_line()",
            "    array.push(lvls, line.new(bar_index, close, bar_index, close))",
            "plot(close)",
        ].join("\n");
        const { scaffold, diagnostics, analysis } = setup(src);
        const site: DrawingCallSite = {
            ...realDrawSite(analysis, "line.new"),
            camp: { kind: "camp-c-bounded", reasoning: "bounded by indicator cap=30" },
        };
        transformCampC(site, analysis, scaffold, diagnostics);
        expect(scaffold.handleRings).toEqual([]);
        const reject = diagnostics
            .toArray()
            .find((d) => d.code === "pine-converter/semantic/unbounded-handle-collection");
        expect(reject).toBeDefined();
    });
});

describe("campCRejects — table integrity", () => {
    it("returns an empty suggestion for an unregistered code", () => {
        // `rejectSuggestion` guards against a code missing from the table.
        const missing = "not-a-code" as unknown as Parameters<typeof rejectSuggestion>[0];
        expect(
            rejectSuggestion(missing, {
                site: { ...baseDummy() },
                collectionName: null,
                inferredCap: null,
            }),
        ).toBe("");
    });

    it("every registered template renders a non-empty string", () => {
        for (const [code, entry] of CAMP_C_REJECTS) {
            const text = entry.template({
                site: baseDummy(),
                collectionName: "lvls",
                inferredCap: 12,
            });
            expect(text.length).toBeGreaterThan(0);
            expect(entry.code).toBe(code);
        }
    });

    function baseDummy(): DrawingCallSite {
        return {
            call: syntheticCall(["line", "new"]),
            constructor: "line.new",
            handleType: "line",
            camp: { kind: "camp-c-unbounded", reasoning: "x" },
            span: SPAN,
        };
    }
});
