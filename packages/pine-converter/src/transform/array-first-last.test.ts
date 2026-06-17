// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { CallExpression, ExpressionNode } from "../ast/index.js";
import type { Declaration } from "../ast/script.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { analyze } from "../semantic/index.js";
import { mapArrayBuiltin } from "./arrayBuiltinMap.js";
import { transformCampB } from "./campB.js";
import { transformDeclaration } from "./declaration.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import type { ScriptScaffold } from "./ir.js";

type ConvertibleDecl = Extract<
    Declaration,
    { kind: "indicator-declaration" | "strategy-declaration" }
>;

// Parse `x = <expr>` and return the call-expression value.
function callOf(expr: string): CallExpression {
    const src = `//@version=6\nindicator("a")\nx = ${expr}\n`;
    const script = parseStatements(lex(src).tokens).script;
    const assignment = script.body.find((stmt) => stmt.kind === "assignment");
    if (assignment === undefined || assignment.kind !== "assignment") {
        throw new Error("expected an assignment");
    }
    const value: ExpressionNode = assignment.value;
    if (value.kind !== "call-expression") {
        throw new Error("expected a call-expression value");
    }
    return value;
}

const NO_ANNOTATIONS = new Map();

describe("mapArrayBuiltin", () => {
    it("maps array.first to ring.at(0)", () => {
        const result = mapArrayBuiltin(callOf("array.first(lvls)"), "__lvls_ring", NO_ANNOTATIONS);
        expect(result).toEqual({ kind: "source", source: "__lvls_ring.at(0)" });
    });

    it("maps array.last to ring.at(ring.size() - 1)", () => {
        const result = mapArrayBuiltin(callOf("array.last(lvls)"), "__lvls_ring", NO_ANNOTATIONS);
        expect(result).toEqual({
            kind: "source",
            source: "__lvls_ring.at(__lvls_ring.size() - 1)",
        });
    });

    it("maps array.size to ring.size()", () => {
        const result = mapArrayBuiltin(callOf("array.size(lvls)"), "__lvls_ring", NO_ANNOTATIONS);
        expect(result).toEqual({ kind: "source", source: "__lvls_ring.size()" });
    });

    it("maps array.get with a non-literal index to ring.at(i)", () => {
        const result = mapArrayBuiltin(callOf("array.get(lvls, i)"), "__lvls_ring", NO_ANNOTATIONS);
        expect(result).toEqual({ kind: "source", source: "__lvls_ring.at(i)" });
    });

    it("maps array.get with a non-negative literal index to ring.at(N)", () => {
        const result = mapArrayBuiltin(callOf("array.get(lvls, 2)"), "__lvls_ring", NO_ANNOTATIONS);
        expect(result).toEqual({ kind: "source", source: "__lvls_ring.at(2)" });
    });

    it("rejects a literal -1 index with negative-array-index", () => {
        const result = mapArrayBuiltin(
            callOf("array.get(lvls, -1)"),
            "__lvls_ring",
            NO_ANNOTATIONS,
        );
        expect(result).toEqual({ kind: "reject", code: "negative-array-index" });
    });

    it("rejects any negative magnitude literal index", () => {
        const result = mapArrayBuiltin(
            callOf("array.get(lvls, -3)"),
            "__lvls_ring",
            NO_ANNOTATIONS,
        );
        expect(result).toEqual({ kind: "reject", code: "negative-array-index" });
    });

    it("treats a unary + literal index as the positive magnitude", () => {
        const result = mapArrayBuiltin(
            callOf("array.get(lvls, +4)"),
            "__lvls_ring",
            NO_ANNOTATIONS,
        );
        expect(result).toEqual({ kind: "source", source: "__lvls_ring.at(+4)" });
    });

    it("returns null for array.get missing its index argument", () => {
        expect(
            mapArrayBuiltin(callOf("array.get(lvls)"), "__lvls_ring", NO_ANNOTATIONS),
        ).toBeNull();
    });

    it("returns null for a write builtin like array.push", () => {
        expect(
            mapArrayBuiltin(callOf("array.push(lvls, x)"), "__lvls_ring", NO_ANNOTATIONS),
        ).toBeNull();
    });

    it("returns null for a non-member callee", () => {
        expect(mapArrayBuiltin(callOf("foo(lvls)"), "__lvls_ring", NO_ANNOTATIONS)).toBeNull();
    });
});

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

describe("transformCampB — linefill over the ring rejects", () => {
    it("rejects a linefill over collection elements and registers no ring", () => {
        const { scaffold, diagnostics } = runCampB(
            [
                "var lvls = array.new_line()",
                "array.push(lvls, line.new(bar_index, close, bar_index, close))",
                "if array.size(lvls) > 10",
                "    line.delete(array.shift(lvls))",
                "fill = linefill.new(array.get(lvls, 0), array.get(lvls, 1), color.blue)",
            ].join("\n"),
        );
        expect(scaffold.handleRings).toHaveLength(0);
        expect(diagnostics.has("pine-converter/transform/linefill-over-ring")).toBe(true);
    });

    it("detects a linefill nested inside an if branch", () => {
        const { scaffold, diagnostics } = runCampB(
            [
                "var lvls = array.new_line()",
                "array.push(lvls, line.new(bar_index, close, bar_index, close))",
                "if array.size(lvls) > 10",
                "    line.delete(array.shift(lvls))",
                "if close > open",
                "    fill = linefill.new(array.get(lvls, 0), array.get(lvls, 1), color.blue)",
            ].join("\n"),
        );
        expect(scaffold.handleRings).toHaveLength(0);
        expect(diagnostics.has("pine-converter/transform/linefill-over-ring")).toBe(true);
    });

    it("detects a linefill nested inside an else branch", () => {
        const { scaffold, diagnostics } = runCampB(
            [
                "var lvls = array.new_line()",
                "array.push(lvls, line.new(bar_index, close, bar_index, close))",
                "if array.size(lvls) > 10",
                "    line.delete(array.shift(lvls))",
                "if close > open",
                "    plot(close)",
                "else",
                "    fill = linefill.new(array.get(lvls, 0), array.get(lvls, 1), color.blue)",
            ].join("\n"),
        );
        expect(scaffold.handleRings).toHaveLength(0);
        expect(diagnostics.has("pine-converter/transform/linefill-over-ring")).toBe(true);
    });

    it("ignores a linefill whose array.get target is a computed receiver", () => {
        const { scaffold, diagnostics } = runCampB(
            [
                "var lvls = array.new_line()",
                "array.push(lvls, line.new(bar_index, close, bar_index, close))",
                "if array.size(lvls) > 10",
                "    line.delete(array.shift(lvls))",
                "fill = linefill.new(array.get(other(), 0), array.get(lvls, 1), color.blue)",
            ].join("\n"),
        );
        // The first array.get reads `other()` (non-identifier arg), exercising
        // the identifier guard; the second still references the ring → reject.
        expect(scaffold.handleRings).toHaveLength(0);
        expect(diagnostics.has("pine-converter/transform/linefill-over-ring")).toBe(true);
    });
});
