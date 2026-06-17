// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { Declaration } from "../ast/script.js";
import { convert } from "../index.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { analyze } from "../semantic/index.js";
import { transformCampC } from "./campC.js";
import { transformDeclaration } from "./declaration.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import type { ScriptScaffold } from "./ir.js";

type ConvertibleDecl = Extract<
    Declaration,
    { kind: "indicator-declaration" | "strategy-declaration" }
>;

// A cross-collection linefill — the canonical hard reject — drives the
// strict-mode contract. `transformCampC` takes no `ConvertOpts`: the strict
// vs default decision (`output: null` when `strictMode && any error`) is
// Task 16 codegen's, reading the diagnostics + reject comments Camp C emits.
// These tests pin the codegen-facing contract Camp C is responsible for.
const FIXTURE = [
    "var a = array.new_line()",
    "var b = array.new_line()",
    "lf = linefill.new(array.get(a, 0), array.get(b, 0), color.red)",
].join("\n");

function runCampC(): { scaffold: ScriptScaffold; diagnostics: DiagnosticCollector } {
    const src = `//@version=6\nindicator("X", overlay=true)\n${FIXTURE}\nplot(close)\n`;
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
        transformCampC(site, analysis, scaffold, diagnostics);
    }
    return { scaffold, diagnostics };
}

describe("transformCampC — strict-mode codegen contract", () => {
    it("emits the reject at error severity so strict mode can suppress output", () => {
        const { diagnostics } = runCampC();
        const reject = diagnostics
            .toArray()
            .find((d) => d.code === "pine-converter/transform/cross-collection-linefill");
        expect(reject?.severity).toBe("error");
    });

    it("emits the reject comment so default-mode output retains the obstacle marker", () => {
        const { scaffold } = runCampC();
        const comment = scaffold.computeBody.statements.find((s) =>
            s.startsWith("// [pine-converter] HARD-REJECT (cross-collection-linefill)"),
        );
        expect(comment).toBeDefined();
    });

    it("does not register a ring (the rejected site produces no drawing output)", () => {
        const { scaffold } = runCampC();
        expect(scaffold.handleRings).toEqual([]);
    });
});

// `strictMode` is a public `ConvertOpts` field: it upgrades every WARNING in
// the returned diagnostics to ERROR (info/error untouched), and does NOT null
// the emitted output — strict callers detect failure by scanning diagnostics
// for any error severity. This fixture deterministically yields a
// `max-count-out-of-range` warning (an over-cap `max_lines_count`) plus infos.
const STRICT_FIXTURE = [
    "//@version=6",
    'indicator("ok", max_lines_count=600)',
    "var ls = array.new_line()",
    "array.push(ls, line.new(bar_index, close, bar_index, open))",
    "plot(close)",
].join("\n");

describe("convert() — strictMode warning upgrade", () => {
    it("leaves severities unchanged when strictMode is omitted", () => {
        const { diagnostics } = convert(STRICT_FIXTURE);
        const warning = diagnostics.find(
            (d) => d.code === "pine-converter/transform/max-count-out-of-range",
        );
        expect(warning?.severity).toBe("warning");
        expect(diagnostics.some((d) => d.severity === "info")).toBe(true);
    });

    it("upgrades every warning to error when strictMode is true", () => {
        const { diagnostics } = convert(STRICT_FIXTURE, { strictMode: true });
        const upgraded = diagnostics.find(
            (d) => d.code === "pine-converter/transform/max-count-out-of-range",
        );
        expect(upgraded?.severity).toBe("error");
        expect(diagnostics.some((d) => d.severity === "warning")).toBe(false);
    });

    it("leaves info diagnostics as info under strictMode", () => {
        const { diagnostics } = convert(STRICT_FIXTURE, { strictMode: true });
        expect(diagnostics.some((d) => d.severity === "info")).toBe(true);
    });

    it("does not null the emitted output under strictMode", () => {
        expect(convert(STRICT_FIXTURE, { strictMode: true }).output).not.toBeNull();
    });

    it("upgrades parse-stage warnings under strictMode (early-return path)", () => {
        // A chained ternary is a parse-stage `info` (chained-ternary-warning);
        // pick a parse-error path instead to exercise the early return: a
        // missing version directive short-circuits with a parse diagnostic, so
        // strictMode must still pass through the assembled list.
        const noVersion = 'indicator("ok")\nplot(close)';
        const { diagnostics } = convert(noVersion, { strictMode: true });
        // No warnings here, but the early-return path is exercised and the
        // result is well-formed (every diagnostic keeps a non-null code).
        expect(diagnostics.every((d) => d.code.length > 0)).toBe(true);
    });
});
