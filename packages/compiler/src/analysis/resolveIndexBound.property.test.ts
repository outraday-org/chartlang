// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { createProgramForSource } from "../program.js";
import { collectConstNumberEnv, resolveIndexUpperBound } from "./resolveIndexBound.js";

/**
 * A node of a random affine expression tree over the bounded-loop variable
 * `i`, a `const K`, and integer literals, combined with `+`/`−`/`*` and
 * unary `−`. Carries both its rendered source (`src`) and a pure evaluator
 * (`evalAt`) so the test can brute-force the true max index independently
 * of the resolver under test.
 */
type AffineNode = Readonly<{
    src: string;
    evalAt: (i: number, k: number) => number;
}>;

/** A recursive fast-check arbitrary for affine expression trees. */
const { node: affineArb } = fc.letrec<{ node: AffineNode }>((tie) => ({
    node: fc.oneof(
        { depthSize: "small", withCrossShrink: true },
        // Leaves.
        fc.constant<AffineNode>({ src: "i", evalAt: (i) => i }),
        fc.constant<AffineNode>({ src: "K", evalAt: (_i, k) => k }),
        fc
            .integer({ min: -20, max: 20 })
            .map((n) => ({ src: `(${n})`, evalAt: () => n }) satisfies AffineNode),
        // Unary minus.
        tie("node").map(
            (operand) =>
                ({
                    src: `-(${operand.src})`,
                    evalAt: (i, k) => -operand.evalAt(i, k),
                }) satisfies AffineNode,
        ),
        // Binary +, -, *.
        fc
            .tuple(fc.constantFrom("+", "-", "*"), tie("node"), tie("node"))
            .map(
                ([op, left, right]) =>
                    ({
                        src: `(${left.src} ${op} ${right.src})`,
                        evalAt: (i, k) => {
                            const a = left.evalAt(i, k);
                            const b = right.evalAt(i, k);
                            return op === "+" ? a + b : op === "-" ? a - b : a * b;
                        },
                    }) satisfies AffineNode,
            ),
    ),
}));

/**
 * Resolve the upper bound of the FIRST series element-access in `source`,
 * building the lexical `const` environment at that use site — the same
 * wiring `extractMaxLookback` uses (`scopeRoot` is the whole source file).
 */
function resolveFirstAccessBound(source: string): number | null {
    const { sourceFile, checker } = createProgramForSource(source, {
        sourcePath: "property.chart.ts",
    });
    let access: ts.ElementAccessExpression | undefined;
    const visit = (node: ts.Node): void => {
        if (access) return;
        if (ts.isElementAccessExpression(node) && ts.isIdentifier(node.expression)) {
            access = node;
            return;
        }
        ts.forEachChild(node, visit);
    };
    ts.forEachChild(sourceFile, visit);
    if (!access) throw new Error("no element-access in source");
    const argument = access.argumentExpression;
    const constEnv = collectConstNumberEnv(argument, sourceFile);
    return resolveIndexUpperBound(argument, access, { constEnv, checker });
}

/**
 * Resolve the index bound for a source built from a bounded `for` loop, a
 * `const K`, and the given affine index expression.
 */
function resolveLoopIndex(loopHeader: string, constK: number, indexSrc: string): number | null {
    return resolveFirstAccessBound(`
declare const e: import("@invinite-org/chartlang-core").Series<number>;
const K = ${constK};
${loopHeader} { const v = e[${indexSrc}]; void v; }
`);
}

/**
 * Like `resolveLoopIndex`, but a same-named function parameter `K` shadows
 * the outer `const K` at the index use site. Any index sub-term that reads
 * `K` therefore binds to the parameter (unknown runtime value), so a sound
 * resolver must refuse it rather than fold in the outer const's literal.
 */
function resolveParamShadowedLoopIndex(
    loopHeader: string,
    outerK: number,
    indexSrc: string,
): number | null {
    return resolveFirstAccessBound(`
declare const e: import("@invinite-org/chartlang-core").Series<number>;
const K = ${outerK};
function f(K: number) {
    ${loopHeader} { const v = e[${indexSrc}]; void v; }
    return K;
}
void f;
`);
}

describe("resolveIndexUpperBound — soundness properties", () => {
    it("never under-sizes a resolvable affine index (>= the true max, or null)", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: -10, max: 10 }),
                fc.integer({ min: 0, max: 12 }),
                fc.boolean(),
                fc.integer({ min: -20, max: 20 }),
                affineArb,
                (loopStart, span, inclusive, constK, expr) => {
                    const op = inclusive ? "<=" : "<";
                    const limit = inclusive ? loopStart + span : loopStart + span + 1;
                    const loopHeader = `for (let i = ${loopStart}; i ${op} ${limit}; i++)`;
                    const resolved = resolveLoopIndex(loopHeader, constK, expr.src);

                    // Brute-force the true max index over the loop domain.
                    let trueMax = Number.NEGATIVE_INFINITY;
                    const lastI = inclusive ? limit : limit - 1;
                    for (let i = loopStart; i <= lastI; i++) {
                        const value = expr.evalAt(i, constK);
                        if (value > trueMax) trueMax = value;
                    }

                    // An over-approximation may resolve to `null` (safe fallback);
                    // a resolved bound must never be smaller than the true max.
                    if (resolved !== null) {
                        expect(resolved).toBeGreaterThanOrEqual(trueMax);
                    }
                },
            ),
            { numRuns: 200 },
        );
    });

    it("never folds a shadowed const when a parameter binds the same name", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: -10, max: 10 }),
                fc.integer({ min: 0, max: 12 }),
                fc.boolean(),
                fc.integer({ min: -20, max: 20 }),
                affineArb,
                (loopStart, span, inclusive, outerK, expr) => {
                    const op = inclusive ? "<=" : "<";
                    const limit = inclusive ? loopStart + span : loopStart + span + 1;
                    const loopHeader = `for (let i = ${loopStart}; i ${op} ${limit}; i++)`;
                    const resolved = resolveParamShadowedLoopIndex(loopHeader, outerK, expr.src);

                    if (expr.src.includes("K")) {
                        // `K` binds to the unknown parameter, not the outer const,
                        // so no sound finite bound exists — the resolver must
                        // refuse rather than under-size with the stale value.
                        expect(resolved).toBeNull();
                        return;
                    }

                    // No `K` reference: the bound comes only from the loop
                    // variable `i`, so the over-approximation property still holds.
                    let trueMax = Number.NEGATIVE_INFINITY;
                    const lastI = inclusive ? limit : limit - 1;
                    for (let i = loopStart; i <= lastI; i++) {
                        const value = expr.evalAt(i, outerK);
                        if (value > trueMax) trueMax = value;
                    }
                    if (resolved !== null) {
                        expect(resolved).toBeGreaterThanOrEqual(trueMax);
                    }
                },
            ),
            { numRuns: 200 },
        );
    });
});
