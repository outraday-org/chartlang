// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { ExpressionNode } from "../ast/index.js";
import type { ForStatement, Statement } from "../ast/statements.js";
import type { SourceSpan } from "../index.js";
import { emitFor, resolveBound, substituteIterator } from "./controlFlow.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import type { EmitContext } from "./emitContext.js";

const SPAN: SourceSpan = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 };

function ident(name: string): ExpressionNode {
    return { kind: "identifier-expression", name, span: SPAN };
}

const CTX: EmitContext = {
    annotations: new Map(),
    inputNames: new Set(),
    localNames: new Set(),
    stateSlots: new Map(),
};

function plotStmt(): Statement {
    return {
        kind: "expression-statement",
        expression: { kind: "call-expression", callee: ident("plot"), args: [], span: SPAN },
        span: SPAN,
    };
}

function forWithBody(body: readonly Statement[]): ForStatement {
    return {
        kind: "for-statement",
        variable: "i",
        from: intLit("0"),
        to: intLit("0"),
        step: null,
        body: { kind: "block-statement", body, span: SPAN },
        span: SPAN,
    };
}

// Render an unrolled loop body once (the emitBody just stringifies kinds).
function runFor(body: readonly Statement[]): readonly string[] {
    const diagnostics = new DiagnosticCollector();
    return emitFor(
        forWithBody(body),
        CTX,
        diagnostics,
        () => null,
        (stmts) => stmts.map((s) => s.kind),
    );
}

describe("emitFor — nested stateful detection", () => {
    it("detects a stateful primitive in an else-if / else branch", () => {
        const ifStmt: Statement = {
            kind: "if-statement",
            condition: ident("c"),
            thenBody: { kind: "block-statement", body: [], span: SPAN },
            elseIfClauses: [
                {
                    condition: ident("d"),
                    body: { kind: "block-statement", body: [plotStmt()], span: SPAN },
                    span: SPAN,
                },
            ],
            elseBody: { kind: "block-statement", body: [plotStmt()], span: SPAN },
            span: SPAN,
        };
        // Stateful → unrolled (one iteration, i = 0).
        expect(runFor([ifStmt])).toEqual(["if-statement"]);
    });

    it("detects a stateful primitive only in the else branch", () => {
        const ifStmt: Statement = {
            kind: "if-statement",
            condition: ident("c"),
            thenBody: { kind: "block-statement", body: [], span: SPAN },
            elseIfClauses: [
                {
                    condition: ident("d"),
                    body: { kind: "block-statement", body: [], span: SPAN },
                    span: SPAN,
                },
            ],
            elseBody: { kind: "block-statement", body: [plotStmt()], span: SPAN },
            span: SPAN,
        };
        expect(runFor([ifStmt])).toEqual(["if-statement"]);
    });

    it("detects a stateful primitive in an assignment value and unrolls a declaration", () => {
        const statefulAssign: Statement = {
            kind: "assignment",
            operator: ":=",
            name: "x",
            value: { kind: "call-expression", callee: ident("plot"), args: [], span: SPAN },
            span: SPAN,
        };
        const decl: Statement = {
            kind: "variable-declaration",
            qualifier: "none",
            typeAnnotation: null,
            name: "y",
            initializer: ident("i"),
            span: SPAN,
        };
        expect(runFor([statefulAssign, decl])).toEqual(["assignment", "variable-declaration"]);
    });

    it("detects a stateful primitive in a variable declaration initializer", () => {
        const decl: Statement = {
            kind: "variable-declaration",
            qualifier: "none",
            typeAnnotation: null,
            name: "y",
            initializer: { kind: "call-expression", callee: ident("plot"), args: [], span: SPAN },
            span: SPAN,
        };
        expect(runFor([decl])).toEqual(["variable-declaration"]);
    });

    it("detects a stateful primitive in a nested block and ignores break/continue", () => {
        const block: Statement = {
            kind: "block-statement",
            body: [plotStmt()],
            span: SPAN,
        };
        expect(runFor([block])).toEqual(["block-statement"]);
        const nonStateful: Statement = { kind: "break-statement", span: SPAN };
        // No stateful primitive (break is the `default` arm) → runtime for loop.
        const out = runFor([nonStateful]);
        expect(out[0]).toContain("for (let i = 0;");
    });
});

function intLit(value: string): ExpressionNode {
    return { kind: "literal-expression", literalKind: "int", value, span: SPAN };
}

// Build a `for` with explicit bounds/step, run it through `emitFor`, and
// return the rendered statements (emitBody stringifies each statement kind,
// so a non-stateful loop renders a single runtime-`for` string and a stateful
// loop renders one kind per unrolled iteration).
function runForBounds(
    body: readonly Statement[],
    from: ExpressionNode,
    to: ExpressionNode,
    step: ExpressionNode | null,
): readonly string[] {
    const diagnostics = new DiagnosticCollector();
    const stmt: ForStatement = {
        kind: "for-statement",
        variable: "i",
        from,
        to,
        step,
        body: { kind: "block-statement", body, span: SPAN },
        span: SPAN,
    };
    return emitFor(
        stmt,
        CTX,
        diagnostics,
        () => null,
        (stmts) => stmts.map((s) => s.kind),
    );
}

describe("emitFor — loop direction + step (non-stateful runtime loops)", () => {
    const breakStmt: Statement = { kind: "break-statement", span: SPAN };

    it("emits an ascending `<=` / `++` loop", () => {
        const out = runForBounds([breakStmt], intLit("0"), intLit("5"), null);
        expect(out[0]).toContain("for (let i = 0; i <= 5; i++)");
    });

    it("emits a descending `>=` / `--` loop", () => {
        const out = runForBounds([breakStmt], intLit("5"), intLit("1"), null);
        expect(out[0]).toContain("for (let i = 5; i >= 1; i--)");
    });

    it("emits an ascending stepped `+= 2` loop", () => {
        const out = runForBounds([breakStmt], intLit("0"), intLit("6"), intLit("2"));
        expect(out[0]).toContain("for (let i = 0; i <= 6; i += 2)");
    });

    it("emits a descending stepped `+= -2` loop (magnitude of `by`)", () => {
        const out = runForBounds([breakStmt], intLit("6"), intLit("0"), intLit("2"));
        expect(out[0]).toContain("for (let i = 6; i >= 0; i += -2)");
    });
});

describe("emitFor — loop direction + step (stateful unroll)", () => {
    // A stateful body forces the unroll path; emitBody returns one kind per
    // unrolled iteration, so the array length is the iteration count.
    it("unrolls a descending loop in descending order", () => {
        const out = runForBounds([plotStmt()], intLit("3"), intLit("1"), null);
        // i = 3, 2, 1 → three iterations.
        expect(out).toEqual([
            "expression-statement",
            "expression-statement",
            "expression-statement",
        ]);
    });

    it("unrolls a descending stepped loop using the `by` magnitude", () => {
        const out = runForBounds([plotStmt()], intLit("6"), intLit("0"), intLit("2"));
        // i = 6, 4, 2, 0 → four iterations.
        expect(out).toHaveLength(4);
    });
});

// Emit a substituted node's iterator name back to a plain identifier value for
// assertion (only checks the substituted literal value where relevant).
function subValue(node: ExpressionNode): ExpressionNode {
    return substituteIterator(node, "i", 7);
}

describe("resolveBound", () => {
    it("resolves a literal int and a unary-literal int", () => {
        expect(resolveBound(intLit("9"), () => null)).toEqual({
            value: 9,
            fromInputDefault: false,
        });
        expect(
            resolveBound(
                { kind: "unary-expression", operator: "-", operand: intLit("3"), span: SPAN },
                () => null,
            ),
        ).toEqual({ value: -3, fromInputDefault: false });
        expect(
            resolveBound(
                { kind: "unary-expression", operator: "+", operand: intLit("3"), span: SPAN },
                () => null,
            ),
        ).toEqual({ value: 3, fromInputDefault: false });
    });

    it("resolves an identifier bound from an input default", () => {
        expect(resolveBound(ident("len"), (name) => (name === "len" ? 5 : null))).toEqual({
            value: 5,
            fromInputDefault: true,
        });
    });

    it("returns null for an unresolvable bound", () => {
        expect(resolveBound(ident("close"), () => null)).toBeNull();
        expect(
            resolveBound(
                { kind: "unary-expression", operator: "not", operand: ident("x"), span: SPAN },
                () => null,
            ),
        ).toBeNull();
        expect(resolveBound({ kind: "na-expression", span: SPAN }, () => null)).toBeNull();
    });
});

describe("substituteIterator", () => {
    it("substitutes the iterator across every node kind", () => {
        expect(subValue(ident("i"))).toEqual(intLit("7"));
        expect(subValue(ident("j"))).toEqual(ident("j"));
        expect(
            subValue({ kind: "unary-expression", operator: "-", operand: ident("i"), span: SPAN }),
        ).toEqual({ kind: "unary-expression", operator: "-", operand: intLit("7"), span: SPAN });
        expect(
            subValue({
                kind: "binary-expression",
                operator: "+",
                left: ident("i"),
                right: ident("i"),
                span: SPAN,
            }),
        ).toEqual({
            kind: "binary-expression",
            operator: "+",
            left: intLit("7"),
            right: intLit("7"),
            span: SPAN,
        });
        expect(
            subValue({
                kind: "ternary-expression",
                condition: ident("i"),
                consequent: ident("i"),
                alternate: ident("i"),
                span: SPAN,
            }),
        ).toEqual({
            kind: "ternary-expression",
            condition: intLit("7"),
            consequent: intLit("7"),
            alternate: intLit("7"),
            span: SPAN,
        });
        const call = subValue({
            kind: "call-expression",
            callee: ident("f"),
            args: [{ name: null, value: ident("i"), span: SPAN }],
            span: SPAN,
        });
        expect(call.kind === "call-expression" && call.args[0].value).toEqual(intLit("7"));
        expect(
            subValue({
                kind: "member-access-expression",
                head: ident("i"),
                chain: ["x"],
                span: SPAN,
            }),
        ).toEqual({
            kind: "member-access-expression",
            head: intLit("7"),
            chain: ["x"],
            span: SPAN,
        });
        expect(
            subValue({ kind: "member-access-expression", head: null, chain: ["x"], span: SPAN }),
        ).toEqual({ kind: "member-access-expression", head: null, chain: ["x"], span: SPAN });
        expect(
            subValue({
                kind: "history-access-expression",
                receiver: ident("close"),
                offset: ident("i"),
                span: SPAN,
            }),
        ).toEqual({
            kind: "history-access-expression",
            receiver: ident("close"),
            offset: intLit("7"),
            span: SPAN,
        });
        expect(subValue({ kind: "paren-expression", expression: ident("i"), span: SPAN })).toEqual({
            kind: "paren-expression",
            expression: intLit("7"),
            span: SPAN,
        });
        expect(subValue({ kind: "tuple-expression", elements: [ident("i")], span: SPAN })).toEqual({
            kind: "tuple-expression",
            elements: [intLit("7")],
            span: SPAN,
        });
        expect(
            subValue({ kind: "lambda-expression", params: ["x"], body: ident("i"), span: SPAN }),
        ).toEqual({ kind: "lambda-expression", params: ["x"], body: intLit("7"), span: SPAN });
        expect(subValue({ kind: "na-expression", span: SPAN })).toEqual({
            kind: "na-expression",
            span: SPAN,
        });
    });
});
