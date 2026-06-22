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

function historyOf(receiver: ExpressionNode, offset: ExpressionNode): ExpressionNode {
    return { kind: "history-access-expression", receiver, offset, span: SPAN };
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

describe("emitWithContext — state.array slots", () => {
    const intLit = (value: string): ExpressionNode => ({
        kind: "literal-expression",
        literalKind: "int",
        value,
        span: SPAN,
    });
    const arrayCall = (member: string, args: readonly ExpressionNode[]): ExpressionNode => ({
        kind: "call-expression",
        callee: {
            kind: "member-access-expression",
            head: null,
            chain: member.split("."),
            span: SPAN,
        },
        args: args.map((value) => ({ name: null, value, span: SPAN })),
        span: SPAN,
    });
    const arrayCtx = (over: Partial<EmitContext> = {}): EmitContext =>
        ctx({ arraySlots: new Map([["win", { local: "win", cap: 20 }]]), ...over });

    it("rewrites array.push(coll, v) → <slot>.push(v)", () => {
        expect(
            emitWithContext(arrayCall("array.push", [ident("win"), ident("close")]), arrayCtx()),
        ).toBe("win.push(bar.close)");
    });

    it("rewrites array.get(coll, n) → <slot>.get(<slot>.size - 1 - (n))", () => {
        // Pine indexes from oldest (0) while chartlang `get(0)` is newest, so
        // the index is inverted to read the same element.
        expect(
            emitWithContext(arrayCall("array.get", [ident("win"), intLit("2")]), arrayCtx()),
        ).toBe("win.get(win.size - 1 - (2))");
    });

    it("rewrites array.size(coll) → <slot>.size", () => {
        expect(emitWithContext(arrayCall("array.size", [ident("win")]), arrayCtx())).toBe(
            "win.size",
        );
    });

    it("rewrites array.last(coll) → <slot>.last()", () => {
        expect(emitWithContext(arrayCall("array.last", [ident("win")]), arrayCtx())).toBe(
            "win.last()",
        );
    });

    it("rewrites array.first(coll) → <slot>.get(<slot>.size - 1)", () => {
        expect(emitWithContext(arrayCall("array.first", [ident("win")]), arrayCtx())).toBe(
            "win.get(win.size - 1)",
        );
    });

    it("rewrites array.clear(coll) → <slot>.clear()", () => {
        expect(emitWithContext(arrayCall("array.clear", [ident("win")]), arrayCtx())).toBe(
            "win.clear()",
        );
    });

    it("lowers a missing push value to an empty argument", () => {
        // Defensive: a malformed `array.push(win)` (no value) emits `win.push()`.
        expect(emitWithContext(arrayCall("array.push", [ident("win")]), arrayCtx())).toBe(
            "win.push()",
        );
    });

    it("leaves an unrecognised array.* member over a slot to the generic path", () => {
        expect(emitWithContext(arrayCall("array.pop", [ident("win")]), arrayCtx())).toBe(
            "array.pop(win)",
        );
    });

    it("leaves an array.* call whose first arg is not a slot identifier untouched", () => {
        // `array.size(close[1])` — first arg is a history access, not a bare
        // slot identifier — so the array rewrite does not fire.
        expect(
            emitWithContext(
                arrayCall("array.size", [historyOf(ident("close"), intLit("1"))]),
                arrayCtx(),
            ),
        ).toBe("array.size(bar.close[1])");
    });

    it("leaves an array.* call with no arguments untouched", () => {
        expect(emitWithContext(arrayCall("array.new", []), arrayCtx())).toBe("array.new()");
    });

    it("leaves an array.* call untouched when no array slots are registered", () => {
        expect(emitWithContext(arrayCall("array.size", [ident("win")]), ctx())).toBe(
            "array.size(win)",
        );
    });
});
