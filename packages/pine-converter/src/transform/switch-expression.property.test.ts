// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import type { ExpressionNode, SwitchExpressionCase } from "../ast/index.js";
import type { SourceSpan } from "../index.js";
import type { AstNode, SemanticAnnotation } from "../semantic/index.js";
import { emitExpr } from "./exprEmit.js";

// Pinned seed so a flaky failure reproduces identically for everyone.
const SEED = 0xc0de;
const SPAN: SourceSpan = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 };
const noAnnotations: ReadonlyMap<AstNode, SemanticAnnotation> = new Map();

// True when `expr` is a syntactically valid TypeScript expression (syntax only,
// no type-checking) — the same probe the coordinate property test uses.
function parsesAsTs(expr: string): boolean {
    const result = ts.transpileModule(`const __probe = (${expr});`, {
        reportDiagnostics: true,
        compilerOptions: { target: ts.ScriptTarget.ESNext },
    });
    return (result.diagnostics ?? []).length === 0;
}

const intLit = (value: number): ExpressionNode => ({
    kind: "literal-expression",
    literalKind: "int",
    value: String(value),
    span: SPAN,
});

describe("value-form switch lowering — property", () => {
    const arms = fc.array(
        fc.tuple(fc.integer({ min: 0, max: 99 }), fc.integer({ min: 0, max: 99 })),
        {
            minLength: 1,
            maxLength: 6,
        },
    );

    it("lowers any N-arm subject switch to well-formed TS ending in Number.NaN", () => {
        fc.assert(
            fc.property(arms, (pairs) => {
                const cases: SwitchExpressionCase[] = pairs.map(([label, value]) => ({
                    test: intLit(label),
                    value: intLit(value),
                    span: SPAN,
                }));
                const node: ExpressionNode = {
                    kind: "switch-expression",
                    subject: { kind: "identifier-expression", name: "sel", span: SPAN },
                    cases,
                    span: SPAN,
                };
                const out = emitExpr(node, noAnnotations);
                expect(parsesAsTs(out)).toBe(true);
                expect(out.endsWith(": Number.NaN")).toBe(true);
                // One ` ? ` and one ` : ` per arm (no default arm in this shape).
                expect((out.match(/ \? /g) ?? []).length).toBe(pairs.length);
            }),
            { seed: SEED, numRuns: 100 },
        );
    });

    it("lowers any N-arm subject-less switch to well-formed TS", () => {
        fc.assert(
            fc.property(arms, (pairs) => {
                const cases: SwitchExpressionCase[] = pairs.map(([cond, value]) => ({
                    test: intLit(cond),
                    value: intLit(value),
                    span: SPAN,
                }));
                const node: ExpressionNode = {
                    kind: "switch-expression",
                    subject: null,
                    cases,
                    span: SPAN,
                };
                const out = emitExpr(node, noAnnotations);
                expect(parsesAsTs(out)).toBe(true);
                expect(out.endsWith(": Number.NaN")).toBe(true);
            }),
            { seed: SEED, numRuns: 100 },
        );
    });
});
