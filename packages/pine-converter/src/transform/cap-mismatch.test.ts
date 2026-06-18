// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { CallExpression } from "../ast/index.js";
import type { Declaration } from "../ast/script.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { analyze } from "../semantic/index.js";
import type { DrawingCallSite, SymbolInfo } from "../semantic/index.js";
import { transformCampB } from "./campB.js";
import { transformDeclaration } from "./declaration.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import type { ScriptScaffold } from "./ir.js";
import { CHARTLANG_BUCKET_CAP, registerRing, resolveRingCap } from "./ringHelper.js";

type ConvertibleDecl = Extract<
    Declaration,
    { kind: "indicator-declaration" | "strategy-declaration" }
>;

function runCampB(body: string): {
    scaffold: ScriptScaffold;
    diagnostics: DiagnosticCollector;
} {
    const src = `//@version=6\nindicator("X", overlay=true)\n${body}\nplot(close)\n`;
    const analysis = analyze(parseStatements(lex(src).tokens).script);
    const decl = analysis.script.declaration;
    if (
        decl === null ||
        decl.kind === "library-declaration" ||
        decl.kind === "import-declaration"
    ) {
        throw new Error("expected an indicator declaration in the fixture");
    }
    const diagnostics = new DiagnosticCollector();
    const scaffold = transformDeclaration(decl as ConvertibleDecl, analysis, diagnostics);
    for (const site of analysis.drawingSites) {
        if (site.camp.kind === "camp-b") {
            transformCampB(site, analysis, scaffold, diagnostics);
        }
    }
    return { scaffold, diagnostics };
}

const SPAN = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 } as const;

function syntheticSite(handleType: SymbolInfo["handleType"], cap: number): DrawingCallSite {
    const call: CallExpression = {
        kind: "call-expression",
        callee: {
            kind: "member-access-expression",
            head: null,
            chain: ["line", "new"],
            span: SPAN,
        },
        args: [],
        span: SPAN,
    };
    const symbol: SymbolInfo = {
        name: "coll",
        kind: "var-variable",
        declarationSpan: SPAN,
        typeAnnotation: null,
        qualifier: "series",
        handleType,
    };
    return {
        call,
        constructor: "line.new",
        handleType: handleType ?? "line",
        camp: { kind: "camp-b", collectionSymbol: symbol, cap, capSource: "max-count-decl" },
        span: SPAN,
    };
}

describe("CHARTLANG_BUCKET_CAP", () => {
    it("caps lines/boxes/labels at 500 and polylines at 100", () => {
        expect(CHARTLANG_BUCKET_CAP).toEqual({
            line: 500,
            box: 500,
            label: 500,
            polyline: 100,
        });
    });
});

describe("resolveRingCap", () => {
    it("clamps an over-bucket cap and emits cap-mismatch", () => {
        const diagnostics = new DiagnosticCollector();
        const cap = resolveRingCap(syntheticSite("line", 900), diagnostics);
        expect(cap).toBe(500);
        expect(diagnostics.has("pine-converter/transform/cap-mismatch")).toBe(true);
    });

    it("keeps an in-bucket cap unchanged with no diagnostic", () => {
        const diagnostics = new DiagnosticCollector();
        const cap = resolveRingCap(syntheticSite("line", 30), diagnostics);
        expect(cap).toBe(30);
        expect(diagnostics.has("pine-converter/transform/cap-mismatch")).toBe(false);
    });

    it("uses the polyline bucket cap of 100", () => {
        const diagnostics = new DiagnosticCollector();
        expect(resolveRingCap(syntheticSite("polyline", 200), diagnostics)).toBe(100);
    });

    it("rejects a zero or negative cap with ring-buffer-zero-cap", () => {
        const diagnostics = new DiagnosticCollector();
        expect(resolveRingCap(syntheticSite("line", 0), diagnostics)).toBeNull();
        expect(resolveRingCap(syntheticSite("line", -5), diagnostics)).toBeNull();
        expect(diagnostics.has("pine-converter/transform/ring-buffer-zero-cap")).toBe(true);
    });

    it("returns null for a non-camp-b site", () => {
        const diagnostics = new DiagnosticCollector();
        const campA: DrawingCallSite = {
            call: syntheticSite("line", 10).call,
            constructor: "line.new",
            handleType: "line",
            camp: {
                kind: "camp-a",
                handleSymbol: {
                    name: "lvl",
                    kind: "var-variable",
                    declarationSpan: SPAN,
                    typeAnnotation: null,
                    qualifier: "series",
                    handleType: "line",
                },
            },
            span: SPAN,
        };
        expect(resolveRingCap(campA, diagnostics)).toBeNull();
    });
});

describe("registerRing", () => {
    it("appends a HandleRingIR and returns the ring local", () => {
        const { scaffold } = runCampB(
            [
                "var lvls = array.new_line()",
                "array.push(lvls, line.new(bar_index, close, bar_index, close))",
            ].join("\n"),
        );
        const name = registerRing(scaffold, "extra", "line", 7);
        expect(name).toBe("extra");
        expect(scaffold.handleRings).toContainEqual({ name: "extra", kind: "line", cap: 7 });
    });
});

describe("transformCampB — cap mismatch end-to-end", () => {
    it("clamps an over-bucket eviction cap to the bucket limit", () => {
        const { scaffold, diagnostics } = runCampB(
            [
                "var lvls = array.new_line()",
                "array.push(lvls, line.new(bar_index, close, bar_index, close))",
                "if array.size(lvls) > 900",
                "    line.delete(array.shift(lvls))",
            ].join("\n"),
        );
        expect(scaffold.handleRings).toEqual([{ name: "lvls", kind: "line", cap: 500 }]);
        expect(diagnostics.has("pine-converter/transform/cap-mismatch")).toBe(true);
    });

    it("skips a zero-cap collection and registers no ring", () => {
        const { scaffold, diagnostics } = runCampB(
            [
                "var lvls = array.new_line()",
                "array.push(lvls, line.new(bar_index, close, bar_index, close))",
                "if array.size(lvls) > 0",
                "    line.delete(array.shift(lvls))",
            ].join("\n"),
        );
        expect(scaffold.handleRings).toHaveLength(0);
        expect(diagnostics.has("pine-converter/transform/ring-buffer-zero-cap")).toBe(true);
    });
});
