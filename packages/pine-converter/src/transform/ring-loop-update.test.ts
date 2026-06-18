// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { Declaration } from "../ast/script.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { analyze } from "../semantic/index.js";
import { transformCampB } from "./campB.js";
import { transformDeclaration } from "./declaration.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import type { ScriptScaffold } from "./ir.js";

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

function loopStatement(scaffold: ScriptScaffold): string {
    const loop = scaffold.computeBody.statements.find((s) => s.startsWith("for ("));
    if (loop === undefined) {
        throw new Error("expected a ring-update loop");
    }
    return loop;
}

const BASE = [
    "var lvls = array.new_line()",
    "array.push(lvls, line.new(bar_index, close, bar_index, close))",
    "if array.size(lvls) > 30",
    "    line.delete(array.shift(lvls))",
].join("\n");

describe("transformCampB — loop-driven ring update", () => {
    it("rewrites the array.size loop bound to the literal cap with at(i) gating", () => {
        const { scaffold } = runCampB(
            [
                BASE,
                "for i = 0 to array.size(lvls) - 1",
                "    line.set_xy2(array.get(lvls, i), bar_index, close)",
            ].join("\n"),
        );
        const loop = loopStatement(scaffold);
        expect(loop).toContain("for (let i = 0; i < 30; i++)");
        expect(loop).toContain("const element = lvls.at(i);");
        expect(loop).toContain("if (element === null) continue;");
        expect(loop).toContain("element.update(");
    });

    it("folds the loop setter into the update patch", () => {
        const { scaffold } = runCampB(
            [
                BASE,
                "for i = 0 to array.size(lvls) - 1",
                "    line.set_xy2(array.get(lvls, i), bar_index, close)",
            ].join("\n"),
        );
        expect(loopStatement(scaffold)).toContain("anchors: [");
    });

    it("accepts a bare array.size bound without the - 1", () => {
        const { scaffold } = runCampB(
            [
                BASE,
                "for i = 0 to array.size(lvls)",
                "    line.set_xy2(array.get(lvls, i), bar_index, close)",
            ].join("\n"),
        );
        expect(loopStatement(scaffold)).toContain("for (let i = 0; i < 30; i++)");
    });

    it("collects setters nested inside an if branch in the loop body", () => {
        const { scaffold } = runCampB(
            [
                BASE,
                "for i = 0 to array.size(lvls) - 1",
                "    if close > open",
                "        line.set_xy2(array.get(lvls, i), bar_index, close)",
            ].join("\n"),
        );
        expect(loopStatement(scaffold)).toContain("element.update(");
    });

    it("emits a TODO + anchor-mirror-required when no setter folds", () => {
        const { scaffold, diagnostics } = runCampB(
            [BASE, "for i = 0 to array.size(lvls) - 1", "    plot(array.get(lvls, i))"].join("\n"),
        );
        const loop = loopStatement(scaffold);
        expect(loop).toContain("/* TODO");
        expect(loop).not.toContain("element.update(");
        expect(diagnostics.has("pine-converter/transform/anchor-mirror-required")).toBe(true);
    });

    it("ignores a loop whose setter targets a different iterator", () => {
        const { scaffold, diagnostics } = runCampB(
            [
                BASE,
                "for i = 0 to array.size(lvls) - 1",
                "    line.set_xy2(array.get(lvls, j), bar_index, close)",
            ].join("\n"),
        );
        expect(loopStatement(scaffold)).toContain("/* TODO");
        expect(diagnostics.has("pine-converter/transform/anchor-mirror-required")).toBe(true);
    });

    it("ignores a loop bound that does not read the collection size", () => {
        const { scaffold } = runCampB([BASE, "for i = 0 to 9", "    plot(i)"].join("\n"));
        expect(scaffold.computeBody.statements.some((s) => s.startsWith("for ("))).toBe(false);
    });

    it("ignores a non-set, non-if statement in the loop body", () => {
        const { scaffold, diagnostics } = runCampB(
            [BASE, "for i = 0 to array.size(lvls) - 1", "    x = array.get(lvls, i)"].join("\n"),
        );
        expect(loopStatement(scaffold)).toContain("/* TODO");
        expect(diagnostics.has("pine-converter/transform/anchor-mirror-required")).toBe(true);
    });

    it("ignores a non-setter member call (line.delete) in the loop body", () => {
        const { scaffold, diagnostics } = runCampB(
            [BASE, "for i = 0 to array.size(lvls) - 1", "    line.delete(array.get(lvls, i))"].join(
                "\n",
            ),
        );
        expect(loopStatement(scaffold)).toContain("/* TODO");
        expect(diagnostics.has("pine-converter/transform/anchor-mirror-required")).toBe(true);
    });

    it("ignores a setter whose handle arg is a bare identifier, not array.get", () => {
        const { scaffold, diagnostics } = runCampB(
            [
                BASE,
                "for i = 0 to array.size(lvls) - 1",
                "    line.set_xy2(ln, bar_index, close)",
            ].join("\n"),
        );
        expect(loopStatement(scaffold)).toContain("/* TODO");
        expect(diagnostics.has("pine-converter/transform/anchor-mirror-required")).toBe(true);
    });

    it("ignores a setter whose array.get target is a different collection", () => {
        const { scaffold, diagnostics } = runCampB(
            [
                BASE,
                "for i = 0 to array.size(lvls) - 1",
                "    line.set_xy2(array.get(other, i), bar_index, close)",
            ].join("\n"),
        );
        expect(loopStatement(scaffold)).toContain("/* TODO");
        expect(diagnostics.has("pine-converter/transform/anchor-mirror-required")).toBe(true);
    });

    it("ignores a bare-call (non-member) statement in the loop body", () => {
        const { scaffold } = runCampB(
            [BASE, "for i = 0 to array.size(lvls) - 1", "    foo(i)"].join("\n"),
        );
        expect(loopStatement(scaffold)).toContain("/* TODO");
    });

    it("drops a deep single-coordinate setter and emits anchor-mirror-required", () => {
        const { scaffold, diagnostics } = runCampB(
            [
                BASE,
                "for i = 0 to array.size(lvls) - 1",
                "    line.set_x2(array.get(lvls, i), bar_index)",
            ].join("\n"),
        );
        // `set_x2` is a deep `["anchors", N, "time"]` path the fold drops, so
        // no patch folds and the loop falls back to the TODO form.
        expect(loopStatement(scaffold)).toContain("/* TODO");
        expect(diagnostics.has("pine-converter/transform/set-path-unsupported")).toBe(true);
        expect(diagnostics.has("pine-converter/transform/anchor-mirror-required")).toBe(true);
    });
});
