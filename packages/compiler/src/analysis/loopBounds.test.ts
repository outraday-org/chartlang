// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { createProgramForSource } from "../program.js";
import {
    boundedLoopVarId,
    COMPARISON_OPS,
    parseBoundedForLoop,
    unwrapParens,
} from "./loopBounds.js";

function firstForStatement(source: string): ts.ForStatement {
    const { sourceFile } = createProgramForSource(source, { sourcePath: "demo.chart.ts" });
    let found: ts.ForStatement | undefined;
    const visit = (node: ts.Node): void => {
        if (found) return;
        if (ts.isForStatement(node)) {
            found = node;
            return;
        }
        ts.forEachChild(node, visit);
    };
    ts.forEachChild(sourceFile, visit);
    if (!found) throw new Error("no for statement in source");
    return found;
}

function firstExpressionOfKind<T extends ts.Expression>(
    source: string,
    predicate: (node: ts.Node) => node is T,
): T {
    const { sourceFile } = createProgramForSource(source, { sourcePath: "demo.chart.ts" });
    let found: T | undefined;
    const visit = (node: ts.Node): void => {
        if (found) return;
        if (predicate(node)) {
            found = node;
            return;
        }
        ts.forEachChild(node, visit);
    };
    ts.forEachChild(sourceFile, visit);
    if (!found) throw new Error("no matching expression in source");
    return found;
}

describe("COMPARISON_OPS", () => {
    it("contains the four chartlang loop comparison operators", () => {
        expect(COMPARISON_OPS.has(ts.SyntaxKind.LessThanToken)).toBe(true);
        expect(COMPARISON_OPS.has(ts.SyntaxKind.LessThanEqualsToken)).toBe(true);
        expect(COMPARISON_OPS.has(ts.SyntaxKind.GreaterThanToken)).toBe(true);
        expect(COMPARISON_OPS.has(ts.SyntaxKind.GreaterThanEqualsToken)).toBe(true);
        expect(COMPARISON_OPS.has(ts.SyntaxKind.EqualsEqualsToken)).toBe(false);
    });
});

describe("parseBoundedForLoop", () => {
    it("parses the accepted `<` shape into its bounds", () => {
        const loop = parseBoundedForLoop(firstForStatement("for (let i = 0; i < 5; i++) {}"));
        expect(loop).toEqual({
            varName: "i",
            start: 0,
            op: ts.SyntaxKind.LessThanToken,
            limit: 5,
        });
    });

    it("captures `<=` / `>` / `>=` operators and the start value", () => {
        expect(parseBoundedForLoop(firstForStatement("for (let j = 2; j <= 9; j++) {}"))).toEqual({
            varName: "j",
            start: 2,
            op: ts.SyntaxKind.LessThanEqualsToken,
            limit: 9,
        });
        expect(parseBoundedForLoop(firstForStatement("for (let i = 5; i > 0; i--) {}"))?.op).toBe(
            ts.SyntaxKind.GreaterThanToken,
        );
        expect(parseBoundedForLoop(firstForStatement("for (let i = 5; i >= 0; i--) {}"))?.op).toBe(
            ts.SyntaxKind.GreaterThanEqualsToken,
        );
    });

    it("rejects a missing initializer", () => {
        const node = firstForStatement("let i = 0; for (; i < 5; i++) {}");
        expect(parseBoundedForLoop(node)).toBeNull();
    });

    it("rejects a missing condition", () => {
        expect(
            parseBoundedForLoop(firstForStatement("for (let i = 0; ; i++) { break; }")),
        ).toBeNull();
    });

    it("rejects a missing incrementor", () => {
        expect(
            parseBoundedForLoop(firstForStatement("for (let i = 0; i < 5; ) { i++; }")),
        ).toBeNull();
    });

    it("rejects a non-VariableDeclarationList initializer", () => {
        const node = firstForStatement("let i = 0; for (i = 0; i < 5; i++) {}");
        expect(parseBoundedForLoop(node)).toBeNull();
    });

    it("rejects a multi-declaration initializer", () => {
        expect(
            parseBoundedForLoop(
                firstForStatement("for (let i = 0, j = 0; i < 5; i++) { void j; }"),
            ),
        ).toBeNull();
    });

    it("rejects a non-identifier declaration name", () => {
        expect(
            parseBoundedForLoop(
                firstForStatement("for (const [i] = [0]; 1 < 5; ) { void i; break; }"),
            ),
        ).toBeNull();
    });

    it("rejects a non-numeric-literal init value", () => {
        const node = firstForStatement("const n = 0; for (let i = n; i < 5; i++) {}");
        expect(parseBoundedForLoop(node)).toBeNull();
    });

    it("rejects a non-binary condition", () => {
        expect(parseBoundedForLoop(firstForStatement("for (let i = 0; i; i++) {}"))).toBeNull();
    });

    it("rejects a non-comparison operator condition", () => {
        expect(parseBoundedForLoop(firstForStatement("for (let i = 0; i + 5; i++) {}"))).toBeNull();
    });

    it("rejects a non-literal condition bound", () => {
        const node = firstForStatement("const n = 5; for (let i = 0; i < n; i++) {}");
        expect(parseBoundedForLoop(node)).toBeNull();
    });

    it("accepts an integer input condition bound with a declared max", () => {
        const loop = parseBoundedForLoop(
            firstForStatement("for (let i = 0; i <= (inputs.tol as number); i++) {}"),
            new Map([["tol", 20]]),
        );
        expect(loop).toEqual({
            varName: "i",
            start: 0,
            op: ts.SyntaxKind.LessThanEqualsToken,
            limit: 20,
            inputName: "tol",
        });
    });

    it("accepts an integer input condition bound without a declared max", () => {
        const loop = parseBoundedForLoop(
            firstForStatement("for (let i = 0; i <= inputs.tol; i++) {}"),
            new Map([["tol", null]]),
        );
        expect(loop).toEqual({
            varName: "i",
            start: 0,
            op: ts.SyntaxKind.LessThanEqualsToken,
            limit: null,
            inputName: "tol",
        });
    });

    it("rejects an unknown input condition bound", () => {
        const node = firstForStatement("for (let i = 0; i <= inputs.tol; i++) {}");
        expect(parseBoundedForLoop(node, new Map([["other", 20]]))).toBeNull();
    });

    it("rejects a property-access condition bound that is not rooted at inputs", () => {
        const node = firstForStatement("for (let i = 0; i <= config.tol; i++) {}");
        expect(parseBoundedForLoop(node, new Map([["tol", 20]]))).toBeNull();
    });

    it("rejects a non-identifier condition left side", () => {
        expect(parseBoundedForLoop(firstForStatement("for (let i = 0; 0 < 5; i++) {}"))).toBeNull();
    });

    it("rejects a condition whose left identifier is not the loop var", () => {
        const node = firstForStatement("const j = 0; for (let i = 0; j < 5; i++) {}");
        expect(parseBoundedForLoop(node)).toBeNull();
    });

    it("rejects a non-postfix incrementor", () => {
        expect(parseBoundedForLoop(firstForStatement("for (let i = 0; i < 5; ++i) {}"))).toBeNull();
    });

    it("rejects an incrementor that is not a simple identifier update", () => {
        const node = firstForStatement("const arr = [0]; for (let i = 0; i < 5; arr[0]++) {}");
        expect(parseBoundedForLoop(node)).toBeNull();
    });

    it("rejects an incrementor on a different identifier", () => {
        const node = firstForStatement("let j = 0; for (let i = 0; i < 5; j++) {}");
        expect(parseBoundedForLoop(node)).toBeNull();
    });
});

describe("boundedLoopVarId", () => {
    it("returns the induction-variable identifier for a valid init", () => {
        const id = boundedLoopVarId(firstForStatement("for (let i = 0; i < 5; i++) {}"));
        expect(id?.text).toBe("i");
    });

    it("returns null when the initializer shape is not the legal one", () => {
        const node = firstForStatement("let i = 0; for (i = 0; i < 5; i++) {}");
        expect(boundedLoopVarId(node)).toBeNull();
    });
});

describe("unwrapParens", () => {
    it("returns a bare expression unchanged", () => {
        const lit = firstExpressionOfKind("const v = 7; void v;", ts.isNumericLiteral);
        expect(unwrapParens(lit)).toBe(lit);
    });

    it("peels any number of nested parentheses", () => {
        const paren = firstExpressionOfKind(
            "const v = ((7)); void v;",
            ts.isParenthesizedExpression,
        );
        const inner = unwrapParens(paren);
        expect(ts.isNumericLiteral(inner)).toBe(true);
        expect(inner.getText()).toBe("7");
    });
});
