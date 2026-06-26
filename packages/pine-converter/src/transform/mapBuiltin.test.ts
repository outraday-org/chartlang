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

function intLit(value: string): ExpressionNode {
    return { kind: "literal-expression", literalKind: "int", value, span: SPAN };
}

function historyOf(receiver: ExpressionNode, offset: ExpressionNode): ExpressionNode {
    return { kind: "history-access-expression", receiver, offset, span: SPAN };
}

// A dotted-callee call (`map.put(...)`) over the given args.
function mapCall(member: string, args: readonly ExpressionNode[]): ExpressionNode {
    return {
        kind: "call-expression",
        callee: {
            kind: "member-access-expression",
            head: null,
            chain: member.split("."),
            span: SPAN,
        },
        args: args.map((value) => ({ name: null, value, span: SPAN })),
        span: SPAN,
    };
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

const mapCtx = (over: Partial<EmitContext> = {}): EmitContext =>
    ctx({ mapSlots: new Map([["levels", { local: "levels", cap: 1000 }]]), ...over });

describe("emitWithContext — state.map slots", () => {
    it("rewrites map.put(id, k, v) → <slot>.set(k, v)", () => {
        expect(
            emitWithContext(
                mapCall("map.put", [ident("levels"), intLit("5"), ident("close")]),
                mapCtx(),
            ),
        ).toBe("levels.set(5, bar.close)");
    });

    it("na-bridges map.get(id, k) → (<slot>.get(k) ?? Number.NaN)", () => {
        expect(emitWithContext(mapCall("map.get", [ident("levels"), intLit("5")]), mapCtx())).toBe(
            "(levels.get(5) ?? Number.NaN)",
        );
    });

    it("rewrites map.contains(id, k) → <slot>.has(k)", () => {
        expect(
            emitWithContext(mapCall("map.contains", [ident("levels"), intLit("5")]), mapCtx()),
        ).toBe("levels.has(5)");
    });

    it("rewrites map.remove(id, k) → <slot>.delete(k)", () => {
        expect(
            emitWithContext(mapCall("map.remove", [ident("levels"), intLit("5")]), mapCtx()),
        ).toBe("levels.delete(5)");
    });

    it("rewrites map.size(id) → <slot>.size (a property, not a call)", () => {
        expect(emitWithContext(mapCall("map.size", [ident("levels")]), mapCtx())).toBe(
            "levels.size",
        );
    });

    it("rewrites map.clear(id) → <slot>.clear()", () => {
        expect(emitWithContext(mapCall("map.clear", [ident("levels")]), mapCtx())).toBe(
            "levels.clear()",
        );
    });

    // The codes raised through `mapWarn`.
    const warnCtx = (): { ctx: EmitContext; codes: string[] } => {
        const codes: string[] = [];
        return { ctx: mapCtx({ mapWarn: (code) => codes.push(code) }), codes };
    };

    it("rejects the no-iterator map.keys / map.values with a placeholder + diagnostic", () => {
        for (const member of ["map.keys", "map.values"]) {
            const { ctx: c, codes } = warnCtx();
            expect(emitWithContext(mapCall(member, [ident("levels")]), c)).toBe(
                `Number.NaN /* TODO: ${member} not supported in chartlang */`,
            );
            expect(codes).toEqual(["map-builtin-not-mapped"]);
        }
    });

    it("emits a placeholder + diagnostic for an unmapped map.* over a slot", () => {
        const { ctx: c, codes } = warnCtx();
        expect(emitWithContext(mapCall("map.copy", [ident("levels")]), c)).toBe(
            "Number.NaN /* TODO: map.copy not supported in chartlang */",
        );
        expect(codes).toEqual(["map-builtin-not-mapped"]);
    });

    it("emits the unmapped placeholder with no diagnostic when mapWarn is absent", () => {
        expect(emitWithContext(mapCall("map.copy", [ident("levels")]), mapCtx())).toBe(
            "Number.NaN /* TODO: map.copy not supported in chartlang */",
        );
    });

    it("lowers a missing put value/key to empty arguments", () => {
        // Defensive: a malformed `map.put(levels)` emits `levels.set(, )`.
        expect(emitWithContext(mapCall("map.put", [ident("levels")]), mapCtx())).toBe(
            "levels.set(, )",
        );
    });

    it("leaves a non-map dotted call whose first arg names a slot to the generic path", () => {
        // `math.max(levels, 5)` — callee is not `map.*`, so the rewrite returns
        // null. The generic emit then applies the nested-math passthrough
        // (`math.max` → `Math.max`), proving the map rewrite did not fire (the
        // slot name `levels` survives as a bare arg).
        expect(emitWithContext(mapCall("math.max", [ident("levels"), intLit("5")]), mapCtx())).toBe(
            "Math.max(levels, 5)",
        );
    });

    it("leaves a non-dotted call (identifier callee) over a slot to the generic path", () => {
        // `foo(levels)` — `dottedCallee` is null for an identifier callee.
        expect(
            emitWithContext(
                {
                    kind: "call-expression",
                    callee: ident("foo"),
                    args: [{ name: null, value: ident("levels"), span: SPAN }],
                    span: SPAN,
                },
                mapCtx(),
            ),
        ).toBe("foo(levels)");
    });

    it("leaves a map.* call whose first arg is not a slot identifier untouched", () => {
        expect(
            emitWithContext(
                mapCall("map.size", [historyOf(ident("close"), intLit("1"))]),
                mapCtx(),
            ),
        ).toBe("map.size(bar.close[1])");
    });

    it("leaves a map.* call whose first arg names an UNREGISTERED map untouched", () => {
        expect(emitWithContext(mapCall("map.size", [ident("other")]), mapCtx())).toBe(
            "map.size(other)",
        );
    });

    it("leaves a map.* call with no arguments untouched", () => {
        expect(emitWithContext(mapCall("map.new", []), mapCtx())).toBe("map.new()");
    });

    it("leaves a map.* call untouched when no map slots are registered", () => {
        expect(emitWithContext(mapCall("map.size", [ident("levels")]), ctx())).toBe(
            "map.size(levels)",
        );
    });
});
