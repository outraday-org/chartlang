// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { ExpressionNode } from "../ast/index.js";
import type { SourceSpan } from "../index.js";
import type { EmitContext } from "./emitContext.js";
import { emitWithContext } from "./emitContext.js";

const SPAN: SourceSpan = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 };

function ident(name: string): ExpressionNode {
    return { kind: "identifier-expression", name, span: SPAN };
}

function ctx(over: Partial<EmitContext> = {}): EmitContext {
    return {
        annotations: new Map(),
        inputNames: new Set(),
        localNames: new Set(),
        stateSlots: new Map(),
        ...over,
    };
}

describe("emitWithContext", () => {
    it("rewrites an input reference to inputs.<name>", () => {
        expect(emitWithContext(ident("len"), ctx({ inputNames: new Set(["len"]) }))).toBe(
            "inputs.len",
        );
    });

    it("rewrites a state-slot scalar to <slot>.value", () => {
        expect(
            emitWithContext(ident("n"), ctx({ stateSlots: new Map([["n", "__n_state"]]) })),
        ).toBe("__n_state.value");
    });

    it("leaves a shadowing local untouched", () => {
        expect(
            emitWithContext(
                ident("len"),
                ctx({ inputNames: new Set(["len"]), localNames: new Set(["len"]) }),
            ),
        ).toBe("len");
    });

    it("leaves a plain identifier untouched", () => {
        expect(emitWithContext(ident("foo"), ctx())).toBe("foo");
    });

    it("rewrites through every container node kind", () => {
        const inputs = new Set(["len"]);
        const c = ctx({ inputNames: inputs });
        expect(
            emitWithContext(
                { kind: "unary-expression", operator: "-", operand: ident("len"), span: SPAN },
                c,
            ),
        ).toBe("-inputs.len");
        expect(
            emitWithContext(
                {
                    kind: "binary-expression",
                    operator: "+",
                    left: ident("len"),
                    right: ident("len"),
                    span: SPAN,
                },
                c,
            ),
        ).toBe("inputs.len + inputs.len");
        expect(
            emitWithContext(
                {
                    kind: "ternary-expression",
                    condition: ident("len"),
                    consequent: ident("len"),
                    alternate: ident("len"),
                    span: SPAN,
                },
                c,
            ),
        ).toBe("inputs.len ? inputs.len : inputs.len");
        expect(
            emitWithContext(
                {
                    kind: "call-expression",
                    callee: ident("f"),
                    args: [{ name: null, value: ident("len"), span: SPAN }],
                    span: SPAN,
                },
                c,
            ),
        ).toBe("f(inputs.len)");
        expect(
            emitWithContext(
                { kind: "member-access-expression", head: ident("len"), chain: ["x"], span: SPAN },
                c,
            ),
        ).toBe("inputs.len.x");
        expect(
            emitWithContext(
                { kind: "member-access-expression", head: null, chain: ["a", "b"], span: SPAN },
                c,
            ),
        ).toBe("a.b");
        expect(
            emitWithContext(
                {
                    kind: "history-access-expression",
                    receiver: ident("len"),
                    offset: ident("len"),
                    span: SPAN,
                },
                c,
            ),
        ).toBe("inputs.len[inputs.len]");
        expect(
            emitWithContext({ kind: "paren-expression", expression: ident("len"), span: SPAN }, c),
        ).toBe("(inputs.len)");
        expect(
            emitWithContext({ kind: "tuple-expression", elements: [ident("len")], span: SPAN }, c),
        ).toBe("[inputs.len]");
        expect(
            emitWithContext(
                { kind: "lambda-expression", params: ["x"], body: ident("len"), span: SPAN },
                c,
            ),
        ).toBe("(x) => inputs.len");
        expect(emitWithContext({ kind: "na-expression", span: SPAN }, c)).toBe("Number.NaN");
    });
});

describe("emitWithContext — state.series slots", () => {
    const history = (receiver: ExpressionNode, offset: ExpressionNode): ExpressionNode => ({
        kind: "history-access-expression",
        receiver,
        offset,
        span: SPAN,
    });
    const seriesCtx = (over: Partial<EmitContext> = {}): EmitContext =>
        ctx({
            stateSlots: new Map([["prev", "prev"]]),
            seriesSlots: new Set(["prev"]),
            ...over,
        });

    it("emits a bare slot index for a series-slot history read", () => {
        expect(
            emitWithContext(
                history(ident("prev"), {
                    kind: "literal-expression",
                    literalKind: "int",
                    value: "1",
                    span: SPAN,
                }),
                seriesCtx(),
            ),
        ).toBe("prev[1]");
    });

    it("emits <slot>.value for a series-slot VALUE read (not history)", () => {
        expect(emitWithContext(ident("prev"), seriesCtx())).toBe("prev.value");
    });

    it("falls back to the generic rewrite when the series-slot name has no stateSlots local", () => {
        // Defensive arm: a `seriesSlots` name not present in `stateSlots`
        // (unreachable from `transformOther`, which registers both together) —
        // `seriesSlotReceiver` returns null and the generic recursion runs.
        expect(
            emitWithContext(
                history(ident("prev"), {
                    kind: "literal-expression",
                    literalKind: "int",
                    value: "1",
                    span: SPAN,
                }),
                ctx({ stateSlots: new Map(), seriesSlots: new Set(["prev"]) }),
            ),
        ).toBe("prev[1]");
    });

    it("leaves a non-series history receiver to the generic rewrite", () => {
        expect(
            emitWithContext(
                history(ident("len"), {
                    kind: "literal-expression",
                    literalKind: "int",
                    value: "1",
                    span: SPAN,
                }),
                ctx({ inputNames: new Set(["len"]) }),
            ),
        ).toBe("inputs.len[1]");
    });
});
