// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { createProgramForSource } from "../program.js";
import { collectConstNumberEnv, resolveIndexUpperBound } from "./resolveIndexBound.js";

/**
 * Resolve the upper bound of the FIRST `series[…]` element-access in the
 * source, building the lexical `const` environment at that use site (the
 * same wiring `extractMaxLookback` uses). `e` is a `declare`d series.
 */
function resolveFirstIndex(
    body: string,
    inputLoopBounds: ReadonlyMap<string, number | null> = new Map(),
): number | null {
    const source = `
declare const e: import("@invinite-org/chartlang-core").Series<number>;
${body}
`;
    const { sourceFile, checker } = createProgramForSource(source, {
        sourcePath: "demo.chart.ts",
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
    return resolveIndexUpperBound(argument, access, { constEnv, checker, inputLoopBounds });
}

describe("resolveIndexUpperBound", () => {
    it("resolves a numeric literal to its value", () => {
        expect(resolveFirstIndex("const v = e[7]; void v;")).toBe(7);
    });

    it("resolves a parenthesised numeric literal", () => {
        expect(resolveFirstIndex("const v = e[(3)]; void v;")).toBe(3);
    });

    it("resolves a bare `<` loop induction variable to limit - 1", () => {
        expect(resolveFirstIndex("for (let i = 0; i < 5; i++) { const v = e[i]; void v; }")).toBe(
            4,
        );
    });

    it("resolves a bare `<=` loop induction variable to the limit", () => {
        expect(resolveFirstIndex("for (let i = 0; i <= 4; i++) { const v = e[i]; void v; }")).toBe(
            4,
        );
    });

    it("resolves an input-bound loop induction variable to the input max", () => {
        expect(
            resolveFirstIndex(
                "declare const inputs: Record<string, unknown>; for (let i = 0; i <= (inputs.tol as number); i++) { const v = e[i]; void v; }",
                new Map([["tol", 20]]),
            ),
        ).toBe(20);
    });

    it("refuses an input-bound loop induction variable when max is absent", () => {
        expect(
            resolveFirstIndex(
                "declare const inputs: Record<string, unknown>; for (let i = 0; i <= (inputs.tol as number); i++) { const v = e[i]; void v; }",
                new Map([["tol", null]]),
            ),
        ).toBeNull();
    });

    it("refuses a non-terminating `>` loop induction variable", () => {
        expect(
            resolveFirstIndex("for (let i = 0; i > 5; i++) { const v = e[i]; void v; }"),
        ).toBeNull();
    });

    it("refuses a `>=` loop induction variable", () => {
        expect(
            resolveFirstIndex("for (let i = 0; i >= 5; i++) { const v = e[i]; void v; }"),
        ).toBeNull();
    });

    it("refuses a loop variable reassigned in the body", () => {
        expect(
            resolveFirstIndex("for (let i = 0; i < 5; i++) { i = 100; const v = e[i]; void v; }"),
        ).toBeNull();
    });

    it("refuses a loop variable compound-assigned in the body", () => {
        expect(
            resolveFirstIndex("for (let i = 0; i < 5; i++) { i += 2; const v = e[i]; void v; }"),
        ).toBeNull();
    });

    it("refuses a loop variable extra-incremented in the body", () => {
        expect(
            resolveFirstIndex("for (let i = 0; i < 5; i++) { const v = e[i]; void v; i++; }"),
        ).toBeNull();
    });

    it("refuses a loop variable extra-decremented (prefix `--`) in the body", () => {
        expect(
            resolveFirstIndex("for (let i = 0; i < 5; i++) { const v = e[i]; void v; --i; }"),
        ).toBeNull();
    });

    it("refuses a loop whose init matches but whose incrementor is illegal", () => {
        // `boundedLoopVarId` accepts the `let i = 0` init and the index `i`
        // resolves to it, but `parseBoundedForLoop` rejects the `i += 2`
        // incrementor — so the resolver cannot bound the range.
        expect(
            resolveFirstIndex("for (let i = 0; i < 5; i += 2) { const v = e[i]; void v; }"),
        ).toBeNull();
    });

    it("does not resolve a loop variable through a non-bounded ancestor loop", () => {
        // The enclosing `for` has an assignment initializer (not the legal
        // `let i = <lit>` shape), so `boundedLoopVarId` returns null for it
        // and the index falls through to the const branch (here: nothing).
        expect(
            resolveFirstIndex("let i = 0; for (i = 0; i < 5; i++) { const v = e[i]; void v; }"),
        ).toBeNull();
    });

    it("resolves the declaring loop across nested loops", () => {
        expect(
            resolveFirstIndex(
                "for (let i = 0; i < 9; i++) { for (let j = 0; j < 3; j++) { const v = e[i]; void v; } }",
            ),
        ).toBe(8);
    });

    it("resolves an inner loop variable to the inner loop", () => {
        expect(
            resolveFirstIndex(
                "for (let i = 0; i < 9; i++) { for (let j = 0; j < 3; j++) { const v = e[j]; void v; } }",
            ),
        ).toBe(2);
    });

    it("resolves a const numeric-literal binding", () => {
        expect(resolveFirstIndex("const k = 3; const v = e[k]; void v;")).toBe(3);
    });

    it("resolves a const unary-minus binding to its negative value", () => {
        expect(resolveFirstIndex("const k = -2; const v = e[k]; void v;")).toBe(-2);
    });

    it("resolves a const unary-plus binding to its value", () => {
        expect(resolveFirstIndex("const k = +4; const v = e[k]; void v;")).toBe(4);
    });

    it("ignores a destructuring const declaration when resolving a name", () => {
        // A `const { k } = …` binds `k` via a binding pattern, not an
        // identifier declaration name, so the const collector skips it and
        // the index stays unresolvable.
        expect(
            resolveFirstIndex(
                "declare const o: { k: number }; const { k } = o; const v = e[k]; void v;",
            ),
        ).toBeNull();
    });

    it("resolves a const declared directly in the enclosing switch-case clause", () => {
        expect(
            resolveFirstIndex(
                "declare const sel: number; switch (sel) { case 1: const k = 3; const v = e[k]; void v; break; }",
            ),
        ).toBe(3);
    });

    it("resolves a const declared directly in a switch default clause", () => {
        expect(
            resolveFirstIndex(
                "declare const sel: number; switch (sel) { default: const k = 2; const v = e[k]; void v; }",
            ),
        ).toBe(2);
    });

    it("does not resolve a const declared after the use", () => {
        expect(resolveFirstIndex("const v = e[k]; void v; const k = 3;")).toBeNull();
    });

    it("does not resolve a sibling-block const", () => {
        expect(
            resolveFirstIndex("if (true) { const k = 3; void k; } const v = e[k]; void v;"),
        ).toBeNull();
    });

    it("does not leak an outer const through a non-numeric const shadow", () => {
        expect(
            resolveFirstIndex('const k = 3; { const k = "x"; const v = e[k]; void v; void k; }'),
        ).toBeNull();
    });

    it("does not leak an outer const through a `let` shadow", () => {
        expect(
            resolveFirstIndex("const k = 3; { let k = 1; const v = e[k]; void v; void k; }"),
        ).toBeNull();
    });

    it("resolves a shadowed loop variable from an inner numeric const", () => {
        expect(
            resolveFirstIndex(
                "for (let i = 0; i < 5; i++) { { const i = 2; const v = e[i]; void v; } }",
            ),
        ).toBe(2);
    });

    it("does not resolve a shadowed loop variable through an inner `let`", () => {
        expect(
            resolveFirstIndex(
                "for (let i = 0; i < 5; i++) { { let i = 2; const v = e[i]; void v; } }",
            ),
        ).toBeNull();
    });

    it("does not leak an outer const through a same-named reassigned loop var", () => {
        // The use-site `i` binds to the loop variable (reassigned to 100), not
        // the outer `const i = 2`. The reassignment makes the loop range
        // unboundable, so the resolver must refuse rather than fold in the
        // unrelated outer const's value, which would under-size the buffer.
        expect(
            resolveFirstIndex(
                "const i = 2; for (let i = 0; i < 5; i++) { i = 100; const v = e[i]; void v; }",
            ),
        ).toBeNull();
    });

    it("does not leak an outer const through a same-named function parameter", () => {
        // `e[k]` reads the parameter `k` (unknown runtime value), not the outer
        // `const k = 3`; the parameter shadows it, so the bound is unresolvable.
        expect(
            resolveFirstIndex(
                "const k = 3; function f(k: number) { const v = e[k]; void v; return k; } void f;",
            ),
        ).toBeNull();
    });

    it("ignores a destructured for-init pattern when marking binders", () => {
        // The literal index resolves to 1; the enclosing `for (const [a] = …)`
        // has a non-identifier (array-pattern) induction binding, so the binder
        // marker skips it without disturbing the resolution.
        expect(
            resolveFirstIndex(
                "for (const [a] = [0]; a < 5; ) { const v = e[1]; void v; void a; break; }",
            ),
        ).toBe(1);
    });

    it("ignores a destructured function parameter when marking binders", () => {
        // The literal index resolves to 1; the enclosing function's parameter is
        // an object-binding pattern, so the binder marker skips it.
        expect(
            resolveFirstIndex(
                "function f({ a }: { a: number }) { const v = e[1]; void v; return a; } void f;",
            ),
        ).toBe(1);
    });

    it("does not resolve an unknown identifier (no const, no loop)", () => {
        expect(resolveFirstIndex("declare const j: number; const v = e[j]; void v;")).toBeNull();
    });

    it("resolves a constant-fold of two numeric literals to its sum", () => {
        expect(resolveFirstIndex("const v = e[1 + 2]; void v;")).toBe(3);
    });

    it("resolves `i + 1` to the loop max plus one", () => {
        expect(
            resolveFirstIndex("for (let i = 0; i < 5; i++) { const v = e[i + 1]; void v; }"),
        ).toBe(5);
    });

    it("resolves `i - 1` to the loop max minus one", () => {
        expect(
            resolveFirstIndex("for (let i = 0; i < 5; i++) { const v = e[i - 1]; void v; }"),
        ).toBe(3);
    });

    it("resolves `K - i` largest when i is smallest", () => {
        expect(
            resolveFirstIndex(
                "const K = 4; for (let i = 0; i <= 4; i++) { const v = e[K - i]; void v; }",
            ),
        ).toBe(4);
    });

    it("resolves `2 * i` to twice the loop max", () => {
        expect(
            resolveFirstIndex("for (let i = 0; i < 3; i++) { const v = e[2 * i]; void v; }"),
        ).toBe(4);
    });

    it("resolves a sign-mixed multiplication via endpoint products", () => {
        // i ∈ [0, 2]; -2 * i ∈ [-4, 0] → hi = 0.
        expect(
            resolveFirstIndex("for (let i = 0; i < 3; i++) { const v = e[-2 * i]; void v; }"),
        ).toBe(0);
    });

    it("resolves a nested parenthesised affine expression", () => {
        // i ∈ [0, 4]; (i + K) * 1 ∈ [2, 6] → hi = 6.
        expect(
            resolveFirstIndex(
                "const K = 2; for (let i = 0; i < 5; i++) { const v = e[(i + K) * 1]; void v; }",
            ),
        ).toBe(6);
    });

    it("resolves a unary-plus affine sub-term", () => {
        expect(
            resolveFirstIndex("for (let i = 0; i < 5; i++) { const v = e[+i + 1]; void v; }"),
        ).toBe(5);
    });

    it("resolves an all-negative interval to a negative upper bound", () => {
        // K = 1, i ∈ [2, 4]; K - i ∈ [-3, -1] → hi = -1 (caller clamps to 0).
        expect(
            resolveFirstIndex(
                "const K = 1; for (let i = 2; i < 5; i++) { const v = e[K - i]; void v; }",
            ),
        ).toBe(-1);
    });

    it("does not resolve an unsupported division operator", () => {
        expect(
            resolveFirstIndex("for (let i = 0; i < 5; i++) { const v = e[i / 2]; void v; }"),
        ).toBeNull();
    });

    it("does not resolve an unsupported modulo operator", () => {
        expect(
            resolveFirstIndex("for (let i = 0; i < 5; i++) { const v = e[i % 2]; void v; }"),
        ).toBeNull();
    });

    it("does not resolve an unsupported exponent operator", () => {
        expect(
            resolveFirstIndex("for (let i = 0; i < 5; i++) { const v = e[i ** 2]; void v; }"),
        ).toBeNull();
    });

    it("does not resolve an unsupported bitwise operator", () => {
        expect(
            resolveFirstIndex("for (let i = 0; i < 5; i++) { const v = e[i << 1]; void v; }"),
        ).toBeNull();
    });

    it("does not resolve an unsupported prefix unary operator", () => {
        expect(
            resolveFirstIndex("for (let i = 0; i < 5; i++) { const v = e[~i]; void v; }"),
        ).toBeNull();
    });

    it("does not resolve an affine expression with an unknown sub-term", () => {
        expect(
            resolveFirstIndex(
                "declare const j: number; for (let i = 0; i < 5; i++) { const v = e[i + j]; void v; }",
            ),
        ).toBeNull();
    });

    it("does not resolve an affine expression whose left operand is unknown", () => {
        expect(
            resolveFirstIndex(
                "declare const j: number; for (let i = 0; i < 5; i++) { const v = e[j + i]; void v; }",
            ),
        ).toBeNull();
    });

    it("collapses to null when a non-finite literal overflows the interval", () => {
        expect(resolveFirstIndex("const v = e[1e400]; void v;")).toBeNull();
    });

    it("does not resolve a non-literal, non-affine index node (property access)", () => {
        expect(
            resolveFirstIndex("declare const o: { x: number }; const v = e[o.x]; void v;"),
        ).toBeNull();
    });
});

describe("collectConstNumberEnv", () => {
    it("stops at the scope root so it cannot see outer-scope bindings", () => {
        const source = `
declare const e: import("@invinite-org/chartlang-core").Series<number>;
const outer = 9;
function inner() {
    const v = e[outer];
    void v;
}
void inner;
`;
        const { sourceFile } = createProgramForSource(source, { sourcePath: "demo.chart.ts" });
        let access: ts.ElementAccessExpression | undefined;
        let fnBody: ts.Block | undefined;
        const visit = (node: ts.Node): void => {
            if (ts.isFunctionDeclaration(node) && node.body) fnBody = node.body;
            if (ts.isElementAccessExpression(node) && ts.isIdentifier(node.expression)) {
                access = node;
            }
            ts.forEachChild(node, visit);
        };
        ts.forEachChild(sourceFile, visit);
        if (!access || !fnBody) throw new Error("fixture missing nodes");
        // Scoped to the function body, the outer `const outer = 9` is invisible.
        const env = collectConstNumberEnv(access.argumentExpression, fnBody);
        expect(env.has("outer")).toBe(false);
    });
});
