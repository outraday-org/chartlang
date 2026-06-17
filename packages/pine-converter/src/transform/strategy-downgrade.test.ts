// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { Declaration } from "../ast/script.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { analyze } from "../semantic/index.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import { transformDeclaration } from "./declaration.js";
import type { ScriptScaffold } from "./ir.js";

type ConvertibleDecl = Extract<
    Declaration,
    { kind: "indicator-declaration" | "strategy-declaration" }
>;

function strategyScaffold(args: string, body = "plot(close)"): ScriptScaffold {
    const src = `//@version=6\nstrategy(${args})\n${body}\n`;
    const analysis = analyze(parseStatements(lex(src).tokens).script);
    const decl = analysis.script.declaration as ConvertibleDecl;
    return transformDeclaration(decl, analysis, new DiagnosticCollector());
}

describe("transformDeclaration — strategy downgrade", () => {
    it("strips strategy(...) to a defineIndicator shell with the title as name", () => {
        const scaffold = strategyScaffold('"S", initial_capital=10000');
        expect(scaffold.constructor).toBe("defineIndicator");
        expect(scaffold.name).toBe("S");
        expect(scaffold.diagnostics.map((d) => d.code)).toContain(
            "pine-converter/transform/strategy-as-indicator",
        );
    });

    it("preserves max_*_count buckets across the downgrade", () => {
        const scaffold = strategyScaffold('"S", max_labels_count=12');
        expect(scaffold.maxDrawings.labels).toBe(12);
    });

    it("stays a defineIndicator even with no plot calls", () => {
        const scaffold = strategyScaffold('"S"', "x = close");
        expect(scaffold.constructor).toBe("defineIndicator");
    });
});
