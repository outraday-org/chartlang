// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import type { ConvertOpts } from "../index.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { analyze } from "../semantic/index.js";
import type { ResolvedAnchor } from "./coordinates.js";
import { resolveCoordinates } from "./coordinates.js";

// Pinned seed so a flaky failure reproduces identically for everyone.
const SEED = 0xc007;

// Every string-valued expression slot on a ResolvedAnchor — what the
// downstream codegen splices into TypeScript source.
function exprStrings(anchor: ResolvedAnchor): readonly string[] {
    switch (anchor.kind) {
        case "literal-world-point":
            return [String(anchor.time), String(anchor.price)];
        case "expr-world-point":
        case "bar-time-direct":
        case "chart-point-from-time":
            return [anchor.timeExpr, anchor.priceExpr];
        case "bar-index-historical":
        case "bar-index-future":
        case "chart-point-from-index":
            return [anchor.offsetExpr, anchor.priceExpr];
        case "chart-point-now":
            return [anchor.priceExpr];
        case "chart-point-new":
            return [anchor.timeExpr, anchor.offsetExpr, anchor.priceExpr];
    }
}

// True when `expr` is a syntactically valid TypeScript expression. Uses
// `transpileModule` with `reportDiagnostics` so only syntax errors surface
// (no type-checking, which would need a full Program).
function parsesAsTs(expr: string): boolean {
    const result = ts.transpileModule(`const __probe = (${expr});`, {
        reportDiagnostics: true,
        compilerOptions: { target: ts.ScriptTarget.ESNext },
    });
    return (result.diagnostics ?? []).length === 0;
}

const X_EXPRESSIONS: readonly string[] = [
    "bar_index",
    "bar_index[2]",
    "bar_index + 7",
    "bar_index - 3",
    "bar_index + shift",
    "bar_index - shift",
    "myX",
    "chart.point.now(close)",
    "chart.point.from_index(4, high)",
    "chart.point.from_time(time, low)",
    "chart.point.new(time, 2, hl2)",
];

const OPTS: readonly ConvertOpts[] = [{ barInterval: 60_000 }, { barInterval: null }];

describe("resolveCoordinates — properties", () => {
    it("resolves every coordinate-bearing site to exactly one anchor kind", () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...X_EXPRESSIONS),
                fc.constantFrom(...OPTS),
                (xExpr, opts) => {
                    const src = `//@version=6\nindicator("t")\nvar line ln = na\nln := line.new(${xExpr}, close, bar_index, close)\n`;
                    const result = analyze(parseStatements(lex(src).tokens).script);
                    const { anchors } = resolveCoordinates(result, opts);
                    for (const anchor of anchors.values()) {
                        expect(typeof anchor.kind).toBe("string");
                    }
                    // line.new contributes two coordinate pairs.
                    expect(anchors.size).toBeGreaterThanOrEqual(1);
                },
            ),
            { seed: SEED },
        );
    });

    it("emits only syntactically valid TypeScript expression strings", () => {
        fc.assert(
            fc.property(fc.constantFrom(...X_EXPRESSIONS), (xExpr) => {
                const src = `//@version=6\nindicator("t")\nvar line ln = na\nln := line.new(${xExpr}, close, bar_index, close)\n`;
                const result = analyze(parseStatements(lex(src).tokens).script);
                const { anchors } = resolveCoordinates(result, { barInterval: 1 });
                for (const anchor of anchors.values()) {
                    for (const expr of exprStrings(anchor)) {
                        expect(parsesAsTs(expr)).toBe(true);
                    }
                }
            }),
            { seed: SEED },
        );
    });
});
