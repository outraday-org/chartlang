// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { CallExpression, ExpressionNode } from "../ast/index.js";
import type { Script } from "../ast/script.js";
import type { Statement } from "../ast/statements.js";
import type { SourceSpan } from "../index.js";
import type { DrawingCallSite, SemanticResult, SymbolInfo } from "../semantic/index.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import type { ScriptScaffold } from "./ir.js";
import { transformOther } from "./other.js";

// The top-level `block-statement` arm of `emitStatement` is not produced by the
// real parser (a block only appears as an `if`/`for` body and is unwrapped to a
// statement list), so — following the package's defensive-arm precedent — it is
// exercised here through a hand-built AST. The `return-statement` arm IS
// reachable (a top-level `f() =>` lambda body flattens a `return` into
// `script.body`) but is covered here too for completeness alongside the block.

const SPAN: SourceSpan = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 };

function ident(name: string): ExpressionNode {
    return { kind: "identifier-expression", name, span: SPAN };
}

function scriptWith(body: readonly Statement[]): Script {
    return { kind: "script", version: null, declaration: null, body, span: SPAN };
}

function analysisWith(
    body: readonly Statement[],
    drawingSites: readonly DrawingCallSite[] = [],
    symbols: ReadonlyMap<SourceSpan, SymbolInfo> = new Map(),
): SemanticResult {
    return {
        script: scriptWith(body),
        annotations: new Map(),
        symbols,
        drawingSites,
    } as unknown as SemanticResult;
}

function callOf(callee: ExpressionNode, args: ExpressionNode[]): CallExpression {
    return {
        kind: "call-expression",
        callee,
        args: args.map((value) => ({ name: null, value, span: SPAN })),
        span: SPAN,
    };
}

function member(chain: string[]): ExpressionNode {
    return { kind: "member-access-expression", head: null, chain, span: SPAN };
}

function exprStmt(call: CallExpression): Statement {
    return { kind: "expression-statement", expression: call, span: SPAN };
}

function emptyScaffold(): ScriptScaffold {
    return {
        constructor: "defineIndicator",
        apiVersion: 1,
        name: "X",
        shortName: null,
        overlay: null,
        format: null,
        precision: null,
        scale: null,
        maxDrawings: {},
        maxBarsBack: null,
        inputs: [],
        stateSlots: [],
        handleSlots: [],
        handleRings: [],
        computeBody: { statements: [] },
        diagnostics: [],
    };
}

function run(
    body: readonly Statement[],
    drawingSites: readonly DrawingCallSite[] = [],
    symbols: ReadonlyMap<SourceSpan, SymbolInfo> = new Map(),
): readonly string[] {
    const scaffold = emptyScaffold();
    transformOther(analysisWith(body, drawingSites, symbols), scaffold, new DiagnosticCollector());
    return scaffold.computeBody.statements;
}

describe("transformOther — synthetic defensive arms", () => {
    it("renders a top-level block-statement as a braced block", () => {
        const inner: Statement = {
            kind: "expression-statement",
            expression: {
                kind: "call-expression",
                callee: ident("plot"),
                args: [{ name: null, value: ident("close"), span: SPAN }],
                span: SPAN,
            },
            span: SPAN,
        };
        const block: Statement = { kind: "block-statement", body: [inner], span: SPAN };
        expect(run([block])).toEqual(["{ plot(bar.close); }"]);
    });

    it("drops a top-level return-statement", () => {
        const ret: Statement = { kind: "return-statement", value: ident("close"), span: SPAN };
        expect(run([ret])).toEqual([]);
    });

    it("treats a setter whose first arg is not an identifier as a normal call", () => {
        const call: Statement = {
            kind: "expression-statement",
            expression: {
                kind: "call-expression",
                callee: {
                    kind: "member-access-expression",
                    head: null,
                    chain: ["line", "set_xy1"],
                    span: SPAN,
                },
                args: [
                    {
                        name: null,
                        value: {
                            kind: "literal-expression",
                            literalKind: "int",
                            value: "0",
                            span: SPAN,
                        },
                        span: SPAN,
                    },
                ],
                span: SPAN,
            },
            span: SPAN,
        };
        // No identifier handle target → not drawing-owned → emitted verbatim.
        expect(run([call])).toEqual(["line.set_xy1(0);"]);
    });

    it("owns a camp-b collection symbol from drawingSites", () => {
        const collectionSymbol = { name: "ring" } as unknown as SymbolInfo;
        const site = {
            constructor: "line.new",
            camp: { kind: "camp-b", collectionSymbol, cap: 5, capSource: "max-count-decl" },
        } as unknown as DrawingCallSite;
        // `array.push(ring, line.new(...))` is owned (collection from the site)
        // → skipped; only the trailing plot survives.
        const push = exprStmt(
            callOf(member(["array", "push"]), [
                { kind: "identifier-expression", name: "ring", span: SPAN },
                callOf(member(["line", "new"]), []),
            ]),
        );
        const plot = exprStmt(callOf(ident("plot"), [ident("close")]));
        expect(run([push, plot], [site])).toEqual(["plot(bar.close);"]);
    });

    it("owns a handle-typed symbol from the symbol table", () => {
        const symbols = new Map<SourceSpan, SymbolInfo>([
            [SPAN, { name: "lvl", handleType: "line" } as unknown as SymbolInfo],
        ]);
        const setter = exprStmt(
            callOf(member(["line", "set_xy1"]), [
                { kind: "identifier-expression", name: "lvl", span: SPAN },
            ]),
        );
        expect(run([setter], [], symbols)).toEqual([]);
    });

    it("ignores a push whose collection is not an identifier", () => {
        const push = exprStmt(
            callOf(member(["array", "push"]), [
                { kind: "literal-expression", literalKind: "int", value: "0", span: SPAN },
                callOf(member(["line", "new"]), []),
            ]),
        );
        // Collection not an identifier → not collected → the push is emitted.
        expect(run([push]).join(" ")).toContain("array.push");
    });

    it("emits an eviction-looking guard whose delete is not an array.shift call", () => {
        const symbols = new Map<SourceSpan, SymbolInfo>([
            [SPAN, { name: "ring", handleType: "line" } as unknown as SymbolInfo],
        ]);
        const guard: Statement = {
            kind: "if-statement",
            condition: {
                kind: "binary-expression",
                operator: ">",
                left: callOf(member(["array", "size"]), [
                    { kind: "identifier-expression", name: "ring", span: SPAN },
                ]),
                right: { kind: "literal-expression", literalKind: "int", value: "3", span: SPAN },
                span: SPAN,
            },
            thenBody: {
                kind: "block-statement",
                body: [
                    exprStmt(
                        callOf(member(["line", "delete"]), [
                            { kind: "identifier-expression", name: "x", span: SPAN },
                        ]),
                    ),
                ],
                span: SPAN,
            },
            elseIfClauses: [],
            elseBody: null,
            span: SPAN,
        };
        // The delete arg is a bare identifier (not `array.shift(ring)`), so the
        // body is not a pure eviction → the guard is emitted, not elided.
        expect(run([guard], [], symbols).join(" ")).toContain("if (array.size(ring) > 3)");
    });

    it("skips a bare drawing-constructor statement", () => {
        const construct = exprStmt(
            callOf(member(["box", "new"]), [
                { kind: "identifier-expression", name: "close", span: SPAN },
            ]),
        );
        expect(run([construct])).toEqual([]);
    });

    it("rejects an eviction guard whose body holds a non-call / non-delete statement", () => {
        const symbols = new Map<SourceSpan, SymbolInfo>([
            [SPAN, { name: "ring", handleType: "line" } as unknown as SymbolInfo],
        ]);
        const sizeGuard = (body: readonly Statement[]): Statement => ({
            kind: "if-statement",
            condition: {
                kind: "binary-expression",
                operator: ">",
                left: callOf(member(["array", "size"]), [
                    { kind: "identifier-expression", name: "ring", span: SPAN },
                ]),
                right: { kind: "literal-expression", literalKind: "int", value: "3", span: SPAN },
                span: SPAN,
            },
            thenBody: { kind: "block-statement", body, span: SPAN },
            elseIfClauses: [],
            elseBody: null,
            span: SPAN,
        });
        // A `break` body statement is not an expression-statement → not an
        // eviction delete → the guard is emitted.
        const breakBody = sizeGuard([{ kind: "break-statement", span: SPAN }]);
        expect(run([breakBody], [], symbols).join(" ")).toContain("if (array.size(ring) > 3)");
        // A non-`.delete` call body is likewise not an eviction → emitted.
        const plotBody = sizeGuard([exprStmt(callOf(ident("plot"), [ident("close")]))]);
        expect(run([plotBody], [], symbols).join(" ")).toContain("if (array.size(ring) > 3)");
    });

    it("elides an array.remove eviction guard", () => {
        const symbols = new Map<SourceSpan, SymbolInfo>([
            [SPAN, { name: "ring", handleType: "line" } as unknown as SymbolInfo],
        ]);
        const guard: Statement = {
            kind: "if-statement",
            condition: {
                kind: "binary-expression",
                operator: ">=",
                left: callOf(member(["array", "size"]), [
                    { kind: "identifier-expression", name: "ring", span: SPAN },
                ]),
                right: { kind: "literal-expression", literalKind: "int", value: "3", span: SPAN },
                span: SPAN,
            },
            thenBody: {
                kind: "block-statement",
                body: [
                    exprStmt(
                        callOf(member(["line", "delete"]), [
                            callOf(member(["array", "remove"]), [
                                { kind: "identifier-expression", name: "ring", span: SPAN },
                                {
                                    kind: "literal-expression",
                                    literalKind: "int",
                                    value: "0",
                                    span: SPAN,
                                },
                            ]),
                        ]),
                    ),
                ],
                span: SPAN,
            },
            elseIfClauses: [],
            elseBody: null,
            span: SPAN,
        };
        expect(run([guard], [], symbols)).toEqual([]);
    });

    it("ignores an array.size guard with no collection argument", () => {
        const symbols = new Map<SourceSpan, SymbolInfo>([
            [SPAN, { name: "ring", handleType: "line" } as unknown as SymbolInfo],
        ]);
        const guard: Statement = {
            kind: "if-statement",
            condition: {
                kind: "binary-expression",
                operator: ">",
                left: callOf(member(["array", "size"]), []),
                right: { kind: "literal-expression", literalKind: "int", value: "3", span: SPAN },
                span: SPAN,
            },
            thenBody: { kind: "block-statement", body: [], span: SPAN },
            elseIfClauses: [],
            elseBody: null,
            span: SPAN,
        };
        // No collection arg → not an eviction guard → the (empty) if is emitted.
        expect(run([guard], [], symbols).join(" ")).toContain("if (array.size() > 3)");
    });

    it("ignores a push with a missing pushed value", () => {
        const push = exprStmt(
            callOf(member(["array", "push"]), [
                { kind: "identifier-expression", name: "ring", span: SPAN },
            ]),
        );
        expect(run([push]).join(" ")).toContain("array.push");
    });

    it("renders an empty subjectless switch to no statement", () => {
        const empty: Statement = {
            kind: "switch-statement",
            subject: null,
            cases: [],
            span: SPAN,
        };
        expect(run([empty])).toEqual([]);
    });
});
