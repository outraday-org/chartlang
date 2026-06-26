// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { CallExpression, ExpressionNode } from "../ast/index.js";
import type { BlockStatement, FunctionDeclaration, Statement } from "../ast/statements.js";
import type { SourceSpan } from "../index.js";
import {
    callIsStatefulPrimitive,
    collectUdfBodyFacts,
    functionParamArity,
    resolveUdfStatefulness,
} from "./statefulness.js";
import type { SymbolInfo } from "./types.js";

const SPAN: SourceSpan = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 };

function ident(name: string): ExpressionNode {
    return { kind: "identifier-expression", name, span: SPAN };
}

function lit(): ExpressionNode {
    return { kind: "literal-expression", literalKind: "int", value: "1", span: SPAN };
}

function member(chain: string[], head: ExpressionNode | null = null): ExpressionNode {
    return { kind: "member-access-expression", head, chain, span: SPAN };
}

function call(callee: ExpressionNode, args: ExpressionNode[] = []): CallExpression {
    return {
        kind: "call-expression",
        callee,
        args: args.map((value) => ({ name: null, value, span: SPAN })),
        span: SPAN,
    };
}

function exprStmt(expression: ExpressionNode): Statement {
    return { kind: "expression-statement", expression, span: SPAN };
}

function block(body: Statement[]): BlockStatement {
    return { kind: "block-statement", body, span: SPAN };
}

function udf(name: string, body: Statement[], params: string[] = []): FunctionDeclaration {
    return {
        kind: "function-declaration",
        name,
        params: params.map((p) => ({ name: p, span: SPAN })),
        body: block(body),
        span: SPAN,
    };
}

// A body whose calls cover the given bare callee names, optionally seeded with
// a builtin stateful `ta.ema(...)`.
function bodyCalling(names: string[], seedStateful = false): Statement[] {
    const stmts = names.map((n) => exprStmt(call(ident(n))));
    return seedStateful ? [...stmts, exprStmt(call(member(["ta", "ema"])))] : stmts;
}

function udfMap(...decls: FunctionDeclaration[]): Map<string, FunctionDeclaration> {
    return new Map(decls.map((d) => [d.name, d]));
}

describe("callIsStatefulPrimitive", () => {
    it("recognises the bare stateful primitives", () => {
        expect(callIsStatefulPrimitive(call(ident("plot")))).toBe(true);
        expect(callIsStatefulPrimitive(call(ident("hline")))).toBe(true);
        expect(callIsStatefulPrimitive(call(ident("alert")))).toBe(true);
    });

    it("recognises ta.* and draw.* namespaces", () => {
        expect(callIsStatefulPrimitive(call(member(["ta", "ema"])))).toBe(true);
        expect(callIsStatefulPrimitive(call(member(["draw", "line"])))).toBe(true);
    });

    it("rejects non-stateful and computed callees", () => {
        expect(callIsStatefulPrimitive(call(ident("nz")))).toBe(false);
        expect(callIsStatefulPrimitive(call(member(["math", "abs"])))).toBe(false);
        expect(callIsStatefulPrimitive(call(member(["y"], ident("x"))))).toBe(false);
    });
});

describe("collectUdfBodyFacts — expression traversal", () => {
    it("seeds stateful on a builtin primitive and collects bare-identifier callees", () => {
        const facts = collectUdfBodyFacts(
            block([
                exprStmt(call(member(["ta", "ema"]), [ident("close")])),
                exprStmt(call(ident("cf_a"))),
            ]),
        );
        expect(facts.seedStateful).toBe(true);
        expect([...facts.calls]).toContain("cf_a");
    });

    it("descends every expression node kind", () => {
        const tree: ExpressionNode = {
            kind: "binary-expression",
            operator: "+",
            left: {
                kind: "unary-expression",
                operator: "-",
                operand: {
                    kind: "paren-expression",
                    expression: {
                        kind: "ternary-expression",
                        condition: ident("c"),
                        consequent: {
                            kind: "history-access-expression",
                            receiver: member(["a", "b"], ident("x")),
                            offset: lit(),
                            span: SPAN,
                        },
                        alternate: call(ident("cf_deep"), [
                            { kind: "tuple-expression", elements: [ident("z")], span: SPAN },
                            {
                                kind: "lambda-expression",
                                params: ["p"],
                                body: ident("q"),
                                span: SPAN,
                            },
                            { kind: "na-expression", span: SPAN },
                        ]),
                        span: SPAN,
                    },
                    span: SPAN,
                },
                span: SPAN,
            },
            right: member(["ta"]),
            span: SPAN,
        };
        const facts = collectUdfBodyFacts(block([exprStmt(tree)]));
        expect(facts.seedStateful).toBe(false);
        expect([...facts.calls]).toEqual(["cf_deep"]);
    });
});

describe("collectUdfBodyFacts — statement traversal", () => {
    it("descends each non-block statement kind that carries an expression", () => {
        const stmts: Statement[] = [
            {
                kind: "variable-declaration",
                qualifier: "none",
                typeAnnotation: null,
                name: "v",
                initializer: call(ident("cf_v")),
                span: SPAN,
            },
            {
                kind: "assignment",
                operator: "=",
                name: "w",
                value: call(ident("cf_w")),
                span: SPAN,
            },
            {
                kind: "tuple-declaration",
                names: [{ name: "t", span: SPAN }],
                initializer: call(ident("cf_t")),
                span: SPAN,
            },
            { kind: "return-statement", value: call(ident("cf_r")), span: SPAN },
            { kind: "return-statement", value: null, span: SPAN },
            { kind: "break-statement", span: SPAN },
            { kind: "continue-statement", span: SPAN },
        ];
        const facts = collectUdfBodyFacts(block(stmts));
        expect([...facts.calls].sort()).toEqual(["cf_r", "cf_t", "cf_v", "cf_w"]);
    });

    it("descends if/for/switch with all optional sub-nodes present", () => {
        const stmts: Statement[] = [
            {
                kind: "if-statement",
                condition: call(ident("cf_if")),
                thenBody: block([exprStmt(call(ident("cf_then")))]),
                elseIfClauses: [
                    {
                        condition: call(ident("cf_elif")),
                        body: block([exprStmt(call(ident("cf_elifb")))]),
                        span: SPAN,
                    },
                ],
                elseBody: block([exprStmt(call(ident("cf_else")))]),
                span: SPAN,
            },
            {
                kind: "for-statement",
                variable: "i",
                from: call(ident("cf_from")),
                to: call(ident("cf_to")),
                step: call(ident("cf_step")),
                body: block([exprStmt(call(ident("cf_forbody")))]),
                span: SPAN,
            },
            {
                kind: "switch-statement",
                subject: call(ident("cf_subj")),
                cases: [
                    {
                        test: call(ident("cf_test")),
                        body: [exprStmt(call(ident("cf_caseb")))],
                        span: SPAN,
                    },
                ],
                span: SPAN,
            },
            block([exprStmt(call(ident("cf_block")))]),
            udf("nested", [exprStmt(call(ident("cf_nested")))]),
        ];
        const facts = collectUdfBodyFacts(block(stmts));
        expect([...facts.calls].sort()).toEqual([
            "cf_block",
            "cf_caseb",
            "cf_elif",
            "cf_elifb",
            "cf_else",
            "cf_forbody",
            "cf_from",
            "cf_if",
            "cf_nested",
            "cf_step",
            "cf_subj",
            "cf_test",
            "cf_then",
            "cf_to",
        ]);
    });

    it("descends if/for/switch with the optional sub-nodes absent", () => {
        const stmts: Statement[] = [
            {
                kind: "if-statement",
                condition: call(ident("cf_if2")),
                thenBody: block([]),
                elseIfClauses: [],
                elseBody: null,
                span: SPAN,
            },
            {
                kind: "for-statement",
                variable: "i",
                from: call(ident("cf_from2")),
                to: call(ident("cf_to2")),
                step: null,
                body: block([]),
                span: SPAN,
            },
            {
                kind: "switch-statement",
                subject: null,
                cases: [{ test: null, body: [], span: SPAN }],
                span: SPAN,
            },
        ];
        const facts = collectUdfBodyFacts(block(stmts));
        expect([...facts.calls].sort()).toEqual(["cf_from2", "cf_if2", "cf_to2"]);
    });
});

describe("resolveUdfStatefulness", () => {
    it("returns nothing for an empty UDF set", () => {
        const result = resolveUdfStatefulness(new Map());
        expect(result.classifications).toEqual([]);
        expect(result.recursiveHeads).toEqual([]);
    });

    it("classifies a pure UDF and a builtin-stateful UDF", () => {
        const result = resolveUdfStatefulness(
            udfMap(udf("pure", bodyCalling([])), udf("ind", bodyCalling([], true))),
        );
        const byName = new Map(result.classifications.map((c) => [c.decl.name, c]));
        expect(byName.get("pure")?.stateful).toBe(false);
        expect(byName.get("ind")?.stateful).toBe(true);
        expect(result.recursiveHeads).toEqual([]);
    });

    it("propagates statefulness transitively across the call graph", () => {
        const result = resolveUdfStatefulness(
            udfMap(
                udf("a", bodyCalling(["b"])),
                udf("b", bodyCalling(["c"])),
                udf("c", bodyCalling([], true)),
            ),
        );
        for (const c of result.classifications) {
            expect(c.stateful).toBe(true);
        }
        expect(result.recursiveHeads).toEqual([]);
    });

    it("drops an edge to a non-UDF bare callee", () => {
        const result = resolveUdfStatefulness(udfMap(udf("a", bodyCalling(["nz"]))));
        expect(result.classifications[0]?.stateful).toBe(false);
        expect(result.recursiveHeads).toEqual([]);
    });

    it("rejects direct recursion and forces it stateful", () => {
        const result = resolveUdfStatefulness(udfMap(udf("a", bodyCalling(["a"]))));
        expect(result.classifications[0]?.recursive).toBe(true);
        expect(result.classifications[0]?.stateful).toBe(true);
        expect(result.recursiveHeads.map((h) => h.name)).toEqual(["a"]);
    });

    it("rejects mutual recursion once, on the lexical-first cycle member", () => {
        const result = resolveUdfStatefulness(
            udfMap(udf("b", bodyCalling(["a"])), udf("a", bodyCalling(["b"]))),
        );
        expect(result.classifications.every((c) => c.recursive)).toBe(true);
        expect(result.recursiveHeads.map((h) => h.name)).toEqual(["a"]);
    });

    it("reports one head per disjoint cycle", () => {
        const result = resolveUdfStatefulness(
            udfMap(
                udf("a", bodyCalling(["b"])),
                udf("b", bodyCalling(["a"])),
                udf("c", bodyCalling(["d"])),
                udf("d", bodyCalling(["c"])),
            ),
        );
        expect(result.recursiveHeads.map((h) => h.name).sort()).toEqual(["a", "c"]);
    });

    it("leaves a non-cyclic call chain unflagged", () => {
        const result = resolveUdfStatefulness(
            udfMap(
                udf("a", bodyCalling(["b"])),
                udf("b", bodyCalling(["c"])),
                udf("c", bodyCalling([])),
            ),
        );
        expect(result.classifications.every((c) => !c.recursive)).toBe(true);
        expect(result.recursiveHeads).toEqual([]);
    });
});

describe("functionParamArity", () => {
    function fnSymbol(params: readonly string[] | undefined): SymbolInfo {
        return {
            name: "cf",
            kind: "function",
            declarationSpan: SPAN,
            typeAnnotation: null,
            qualifier: "series",
            handleType: null,
            ...(params === undefined ? {} : { params }),
        };
    }

    it("returns the declared parameter count for a function symbol", () => {
        expect(functionParamArity(fnSymbol(["a", "b"]))).toBe(2);
    });

    it("defaults a function symbol with no params field to arity 0", () => {
        expect(functionParamArity(fnSymbol(undefined))).toBe(0);
    });

    it("returns null for a non-function symbol", () => {
        expect(
            functionParamArity({
                name: "x",
                kind: "variable",
                declarationSpan: SPAN,
                typeAnnotation: null,
                qualifier: "series",
                handleType: null,
            }),
        ).toBeNull();
    });
});
