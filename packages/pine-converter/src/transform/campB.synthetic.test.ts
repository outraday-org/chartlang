// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { CallExpression } from "../ast/index.js";
import type { Declaration } from "../ast/script.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { analyze } from "../semantic/index.js";
import type { DrawingCallSite, SemanticResult, SymbolInfo } from "../semantic/index.js";
import { transformCampB } from "./campB.js";
import { transformDeclaration } from "./declaration.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import type { ScriptScaffold } from "./ir.js";

type ConvertibleDecl = Extract<
    Declaration,
    { kind: "indicator-declaration" | "strategy-declaration" }
>;

const SPAN = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 } as const;

function emptyScaffold(): {
    scaffold: ScriptScaffold;
    diagnostics: DiagnosticCollector;
    analysis: SemanticResult;
} {
    const src = '//@version=6\nindicator("X", overlay=true)\nplot(close)\n';
    const analysis = analyze(parseStatements(lex(src).tokens).script);
    const decl = analysis.script.declaration as ConvertibleDecl;
    const diagnostics = new DiagnosticCollector();
    const scaffold = transformDeclaration(decl, analysis, diagnostics);
    return { scaffold, diagnostics, analysis };
}

function collectionSymbol(): SymbolInfo {
    return {
        name: "coll",
        kind: "var-variable",
        declarationSpan: SPAN,
        typeAnnotation: null,
        qualifier: "series",
        handleType: "line",
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

describe("transformCampB — defensive arms", () => {
    it("does nothing for a non-camp-b site", () => {
        const { scaffold, diagnostics, analysis } = emptyScaffold();
        const site: DrawingCallSite = {
            call: syntheticCall(["line", "new"]),
            constructor: "line.new",
            handleType: "line",
            camp: { kind: "camp-a", handleSymbol: collectionSymbol() },
            span: SPAN,
        };
        transformCampB(site, analysis, scaffold, diagnostics);
        expect(scaffold.handleRings).toHaveLength(0);
        expect(diagnostics.size).toBe(0);
    });

    it("returns null draw kind for an unmapped (linefill) constructor and skips", () => {
        const { scaffold, diagnostics, analysis } = emptyScaffold();
        const site: DrawingCallSite = {
            call: syntheticCall(["linefill", "new"]),
            constructor: "linefill.new",
            handleType: "linefill",
            camp: {
                kind: "camp-b",
                collectionSymbol: collectionSymbol(),
                cap: 10,
                capSource: "max-count-decl",
            },
            span: SPAN,
        };
        transformCampB(site, analysis, scaffold, diagnostics);
        expect(scaffold.handleRings).toHaveLength(0);
    });

    it("emits an unguarded push when the push statement is not found in the body", () => {
        // The classified `.new()` call is not present in this empty script body,
        // so `findPushGuard` falls through to the top-level (unguarded) path.
        const { scaffold, diagnostics, analysis } = emptyScaffold();
        const site: DrawingCallSite = {
            call: syntheticCall(["line", "new"]),
            constructor: "line.new",
            handleType: "line",
            camp: {
                kind: "camp-b",
                collectionSymbol: collectionSymbol(),
                cap: 10,
                capSource: "max-count-decl",
            },
            span: SPAN,
        };
        transformCampB(site, analysis, scaffold, diagnostics);
        expect(scaffold.handleRings).toEqual([{ name: "coll", kind: "line", cap: 10 }]);
        const push = scaffold.computeBody.statements.find((s) => s.includes(".push("));
        expect(push).toBeDefined();
        expect(push).not.toContain("if (");
    });
});
