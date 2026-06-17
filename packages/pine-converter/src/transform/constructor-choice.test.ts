// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { Declaration, Script } from "../ast/script.js";
import type { Statement } from "../ast/index.js";
import type { SemanticResult } from "../semantic/index.js";
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

function scaffoldOf(body: string): ScriptScaffold {
    const src = `//@version=6\nindicator("t")\n${body}\n`;
    const analysis = analyze(parseStatements(lex(src).tokens).script);
    const decl = analysis.script.declaration as ConvertibleDecl;
    return transformDeclaration(decl, analysis, new DiagnosticCollector());
}

function hasDrawingDowngrade(scaffold: ScriptScaffold): boolean {
    return scaffold.diagnostics.some(
        (d) => d.code === "pine-converter/transform/drawing-only-script",
    );
}

const DRAW_BODY = "var line ln = na\nln := line.new(bar_index, close, bar_index, close)";

describe("transformDeclaration — constructor choice", () => {
    it("plot-only → defineIndicator", () => {
        const scaffold = scaffoldOf("plot(close)");
        expect(scaffold.constructor).toBe("defineIndicator");
        expect(hasDrawingDowngrade(scaffold)).toBe(false);
    });

    it("draw-only → defineDrawing with the downgrade info diagnostic", () => {
        const scaffold = scaffoldOf(DRAW_BODY);
        expect(scaffold.constructor).toBe("defineDrawing");
        expect(hasDrawingDowngrade(scaffold)).toBe(true);
    });

    it("mixed plot + draw → defineIndicator", () => {
        const scaffold = scaffoldOf(`plot(close)\n${DRAW_BODY}`);
        expect(scaffold.constructor).toBe("defineIndicator");
        expect(hasDrawingDowngrade(scaffold)).toBe(false);
    });

    it("compute-only (no plot, no draw) → defineIndicator", () => {
        const scaffold = scaffoldOf("x = close + 1");
        expect(scaffold.constructor).toBe("defineIndicator");
        expect(hasDrawingDowngrade(scaffold)).toBe(false);
    });

    it("a plot inside an if/for/switch block still forces defineIndicator", () => {
        const ifScaffold = scaffoldOf("if close > open\n    plot(close)");
        expect(ifScaffold.constructor).toBe("defineIndicator");

        const forScaffold = scaffoldOf("for i = 0 to 2\n    plot(close)");
        expect(forScaffold.constructor).toBe("defineIndicator");

        const switchScaffold = scaffoldOf("switch\n    close > open => plot(close)");
        expect(switchScaffold.constructor).toBe("defineIndicator");
    });

    it("a plot inside an else / else-if arm forces defineIndicator", () => {
        const elseIf = scaffoldOf(
            "if close > open\n    x = 1\nelse if close < open\n    plot(close)",
        );
        expect(elseIf.constructor).toBe("defineIndicator");

        const elseArm = scaffoldOf("if close > open\n    x = 1\nelse\n    plot(close)");
        expect(elseArm.constructor).toBe("defineIndicator");
    });

    it("treats a non-plot member-access call (ta.ema) as no plot", () => {
        const scaffold = scaffoldOf("ta.ema(close, 9)");
        expect(scaffold.constructor).toBe("defineIndicator");
        expect(hasDrawingDowngrade(scaffold)).toBe(false);
    });

    // A top-level `block-statement` can't come from the real parser (blocks
    // only nest inside if/for/switch), so the recursive plot-scan's
    // block-statement arm is exercised with a synthetic AST — the same
    // defensive-arm precedent the parser/semantic suites use.
    it("scans a synthetic top-level block-statement for a plot call", () => {
        const span = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 };
        const plotStatement: Statement = {
            kind: "expression-statement",
            expression: {
                kind: "call-expression",
                callee: { kind: "identifier-expression", name: "plot", span },
                args: [],
                span,
            },
            span,
        };
        const block: Statement = { kind: "block-statement", body: [plotStatement], span };
        const script: Script = {
            kind: "script",
            version: null,
            declaration: {
                kind: "indicator-declaration",
                args: [
                    {
                        name: null,
                        value: {
                            kind: "literal-expression",
                            literalKind: "string",
                            value: '"t"',
                            span,
                        },
                        span,
                    },
                ],
                span,
            },
            body: [block],
            span,
        };
        const analysis = analyze(script) satisfies SemanticResult;
        const decl = analysis.script.declaration as ConvertibleDecl;
        const scaffold = transformDeclaration(decl, analysis, new DiagnosticCollector());
        expect(scaffold.constructor).toBe("defineIndicator");
    });

    it("drops the indicator-only overlay/scale/maxBarsBack on a defineDrawing", () => {
        const src = `//@version=6\nindicator("t", overlay=true, scale=scale.left, max_bars_back=10)\n${DRAW_BODY}\n`;
        const analysis = analyze(parseStatements(lex(src).tokens).script);
        const decl = analysis.script.declaration as ConvertibleDecl;
        const scaffold = transformDeclaration(decl, analysis, new DiagnosticCollector());
        expect(scaffold.constructor).toBe("defineDrawing");
        expect(scaffold.overlay).toBeNull();
        expect(scaffold.scale).toBeNull();
        expect(scaffold.maxBarsBack).toBeNull();
    });
});
