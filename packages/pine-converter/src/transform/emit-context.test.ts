// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { CallExpression, ExpressionNode } from "../ast/index.js";
import type { SourceSpan } from "../index.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { analyze } from "../semantic/index.js";
import { spanKey } from "./callArgs.js";
import { transformCampB } from "./campB.js";
import { transformDeclaration } from "./declaration.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import type { EmitContext } from "./emitContext.js";
import {
    buildDrawingEmitContext,
    emitScalar,
    emitWithContext,
    inputCastType,
    lowerTaToCurrent,
} from "./emitContext.js";
import { transformInputs } from "./inputs.js";

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

    it("rewrites a promoted inline-input call to its inputs.<name> read (cast + bare)", () => {
        const call: CallExpression = {
            kind: "call-expression",
            callee: {
                kind: "member-access-expression",
                head: null,
                chain: ["input", "int"],
                span: SPAN,
            },
            args: [],
            span: SPAN,
        };
        // With a registered cast → `(inputs.<name> as <cast>)`.
        expect(
            emitWithContext(
                call,
                ctx({
                    promotedInline: new Map([[spanKey(SPAN), "inlineInput"]]),
                    inputCasts: new Map([["inlineInput", "number"]]),
                }),
            ),
        ).toBe("(inputs.inlineInput as number)");
        // Without a cast → the bare `inputs.<name>`.
        expect(
            emitWithContext(
                call,
                ctx({ promotedInline: new Map([[spanKey(SPAN), "inlineInput"]]) }),
            ),
        ).toBe("inputs.inlineInput");
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
                { kind: "array-literal-expression", elements: [ident("len")], span: SPAN },
                c,
            ),
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

    const memberOf = (chain: string): ExpressionNode => ({
        kind: "member-access-expression",
        head: null,
        chain: chain.split("."),
        span: SPAN,
    });
    const boolLit = (value: boolean): ExpressionNode => ({
        kind: "literal-expression",
        literalKind: "bool",
        value: String(value),
        span: SPAN,
    });
    // An `arrayCtx` that also captures the codes raised through `arrayWarn`.
    const warnCtx = (): { ctx: EmitContext; codes: string[] } => {
        const codes: string[] = [];
        return { ctx: arrayCtx({ arrayWarn: (code) => codes.push(code) }), codes };
    };

    it("lowers no-arg reductions onto the handle method", () => {
        for (const [member, method] of [
            ["array.sum", "sum"],
            ["array.avg", "avg"],
            ["array.min", "min"],
            ["array.max", "max"],
            ["array.range", "range"],
            ["array.median", "median"],
            ["array.stdev", "stdev"],
            ["array.variance", "variance"],
        ] as const) {
            expect(emitWithContext(arrayCall(member, [ident("win")]), arrayCtx())).toBe(
                `win.${method}()`,
            );
        }
    });

    it("forwards the optional biased flag to variance/stdev when present", () => {
        expect(
            emitWithContext(arrayCall("array.stdev", [ident("win"), boolLit(false)]), arrayCtx()),
        ).toBe("win.stdev(false)");
    });

    it("maps percentile_linear_interpolation(id, p) → <slot>.percentile(p)", () => {
        expect(
            emitWithContext(
                arrayCall("array.percentile_linear_interpolation", [ident("win"), intLit("90")]),
                arrayCtx(),
            ),
        ).toBe("win.percentile(90)");
    });

    it("maps indexof/includes onto the handle methods, forwarding the value", () => {
        expect(
            emitWithContext(arrayCall("array.indexof", [ident("win"), ident("close")]), arrayCtx()),
        ).toBe("win.indexOf(bar.close)");
        expect(
            emitWithContext(
                arrayCall("array.includes", [ident("win"), ident("close")]),
                arrayCtx(),
            ),
        ).toBe("win.includes(bar.close)");
    });

    it('lowers array.sort with order.descending → <slot>.sort("desc") + caveat', () => {
        const { ctx: c, codes } = warnCtx();
        expect(
            emitWithContext(
                arrayCall("array.sort", [ident("win"), memberOf("order.descending")]),
                c,
            ),
        ).toBe('win.sort("desc")');
        expect(codes).toEqual(["array-sort-returns-copy"]);
    });

    it("lowers array.sort ascending/default/unrecognised order → bare <slot>.sort()", () => {
        expect(
            emitWithContext(
                arrayCall("array.sort", [ident("win"), memberOf("order.ascending")]),
                arrayCtx(),
            ),
        ).toBe("win.sort()");
        // No order arg.
        expect(emitWithContext(arrayCall("array.sort", [ident("win")]), arrayCtx())).toBe(
            "win.sort()",
        );
        // An order arg that is not a bare `order.*` enum falls back to ascending.
        expect(
            emitWithContext(arrayCall("array.sort", [ident("win"), ident("dir")]), arrayCtx()),
        ).toBe("win.sort()");
        // A bare `order.*` enum that is not in the map also falls back.
        expect(
            emitWithContext(
                arrayCall("array.sort", [ident("win"), memberOf("order.weird")]),
                arrayCtx(),
            ),
        ).toBe("win.sort()");
    });

    it("rejects percentile_nearest_rank with a placeholder + diagnostic", () => {
        const { ctx: c, codes } = warnCtx();
        expect(
            emitWithContext(
                arrayCall("array.percentile_nearest_rank", [ident("win"), intLit("90")]),
                c,
            ),
        ).toBe("Number.NaN /* TODO: array.percentile_nearest_rank not supported in chartlang */");
        expect(codes).toEqual(["array-reduction-not-mapped"]);
    });

    it("emits a placeholder + diagnostic for an unmapped array.* over a slot", () => {
        const { ctx: c, codes } = warnCtx();
        expect(emitWithContext(arrayCall("array.pop", [ident("win")]), c)).toBe(
            "Number.NaN /* TODO: array.pop not supported in chartlang */",
        );
        expect(codes).toEqual(["array-reduction-not-mapped"]);
    });

    it("emits the unmapped placeholder with no diagnostic when arrayWarn is absent", () => {
        // The `arrayWarn?.` sink short-circuits when undefined (every EmitContext
        // built outside transformOther).
        expect(emitWithContext(arrayCall("array.pop", [ident("win")]), arrayCtx())).toBe(
            "Number.NaN /* TODO: array.pop not supported in chartlang */",
        );
    });

    it("leaves a non-array dotted call whose first arg names a slot to the generic path", () => {
        // `math.max(win, 5)` — the callee is not `array.*`, so the reduction
        // rewrite returns null. The generic emit then applies the nested-math
        // passthrough (`math.max` → `Math.max`), proving the array rewrite did
        // not fire (the slot name `win` survives as a bare arg).
        expect(
            emitWithContext(arrayCall("math.max", [ident("win"), intLit("5")]), arrayCtx()),
        ).toBe("Math.max(win, 5)");
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

describe("emitScalar / lowerTaToCurrent", () => {
    const intLit = (value: string): ExpressionNode => ({
        kind: "literal-expression",
        literalKind: "int",
        value,
        span: SPAN,
    });
    const call = (callee: ExpressionNode, args: readonly ExpressionNode[]): CallExpression => ({
        kind: "call-expression",
        callee,
        args: args.map((value) => ({ name: null, value, span: SPAN })),
        span: SPAN,
    });
    const member = (chain: readonly string[]): ExpressionNode => ({
        kind: "member-access-expression",
        head: null,
        chain: [...chain],
        span: SPAN,
    });
    const taCall = (name: string, args: readonly ExpressionNode[]): CallExpression =>
        call(member(name.split(".")), args);

    it("projects a root ta.* call to .current in scalar position", () => {
        expect(emitScalar(taCall("ta.atr", [intLit("14")]), ctx())).toBe("ta.atr(14).current");
    });

    it("emits a non-ta node identically to emitWithContext", () => {
        expect(emitScalar(ident("close"), ctx())).toBe("bar.close");
    });

    it("lowers a mapped ta.* call and surfaces its signature note", () => {
        // `ta.rma` → `ta.smma` carries a signature-divergence note for the
        // caller (the top-level `emitTa`) to raise.
        const lowering = lowerTaToCurrent(taCall("ta.rma", [ident("close"), intLit("14")]), ctx());
        expect(lowering?.source).toBe("ta.smma(bar.close, 14).current");
        expect(lowering?.signatureNote).toBeDefined();
    });

    it("returns null for a non-ta call and for an unmapped / REJECT ta name", () => {
        expect(lowerTaToCurrent(call(ident("foo"), [ident("close")]), ctx())).toBeNull();
        expect(
            lowerTaToCurrent(taCall("ta.kcw", [ident("close"), intLit("20")]), ctx()),
        ).toBeNull();
    });

    it("leaves an unmapped scalar-position ta.* bare without a sink (no crash)", () => {
        // A `ta.kcw` in scalar position can't lower; with no `taWarn` sink the
        // residual-series warning is a silent no-op and the bare call survives.
        expect(emitScalar(taCall("ta.kcw", [ident("close"), intLit("20")]), ctx())).toBe(
            "ta.kcw(bar.close, 20)",
        );
    });

    it("notifies the taWarn sink for an unmapped scalar-position ta.*", () => {
        const codes: string[] = [];
        emitScalar(
            taCall("ta.kcw", [ident("close"), intLit("20")]),
            ctx({ taWarn: (code) => codes.push(code) }),
        );
        expect(codes).toEqual(["nested-ta-not-lowered"]);
    });

    it("notifies the taWarn sink for a lowered scalar-position ta.*", () => {
        const codes: string[] = [];
        emitScalar(taCall("ta.atr", [intLit("14")]), ctx({ taWarn: (code) => codes.push(code) }));
        expect(codes).toEqual(["nested-ta-lowered"]);
    });

    it("raises no residual warning for a non-ta call in scalar position", () => {
        // An identifier callee (`foo(...)`, dotted callee `null`) and a non-`ta`
        // member callee (`foo.bar(...)`) both skip the residual safety net.
        expect(emitScalar(call(ident("foo"), [ident("close")]), ctx())).toBe("foo(bar.close)");
        expect(emitScalar(call(member(["foo", "bar"]), [ident("close")]), ctx())).toBe(
            "foo.bar(bar.close)",
        );
    });
});

describe("emitWithContext — handle rings", () => {
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
    const intLit = (value: string): ExpressionNode => ({
        kind: "literal-expression",
        literalKind: "int",
        value,
        span: SPAN,
    });
    const ringCtx = (over: Partial<EmitContext> = {}): EmitContext =>
        ctx({ handleRings: new Map([["levels", "levels"]]), ...over });

    it("lowers array.size(<ring>) → <ring>.size() (the cell-text leak fix)", () => {
        expect(emitWithContext(arrayCall("array.size", [ident("levels")]), ringCtx())).toBe(
            "levels.size()",
        );
    });

    it("lowers a nested array.size over a ring inside str.tostring", () => {
        // `str.tostring(array.size(levels))` → `String(levels.size())` — the
        // ring lowering fires even when nested in a call argument.
        const node = arrayCall("str.tostring", [arrayCall("array.size", [ident("levels")])]);
        expect(emitWithContext(node, ringCtx())).toBe("String(levels.size())");
    });

    it("lowers array.get(<ring>, i) → <ring>.at(i)", () => {
        expect(
            emitWithContext(arrayCall("array.get", [ident("levels"), intLit("0")]), ringCtx()),
        ).toBe("levels.at(0)");
    });

    it("leaves a non-ring-mappable array.* over a ring to the generic path", () => {
        // `array.push` is a WRITE builtin (`mapArrayBuiltin` → null), so the ring
        // rewrite falls through and the generic emit re-emits the call as-is.
        expect(
            emitWithContext(arrayCall("array.push", [ident("levels"), ident("close")]), ringCtx()),
        ).toBe("array.push(levels, bar.close)");
    });

    it("ignores array.* over a non-ring identifier", () => {
        expect(emitWithContext(arrayCall("array.size", [ident("other")]), ringCtx())).toBe(
            "array.size(other)",
        );
    });

    it("ignores array.* with no first argument", () => {
        expect(emitWithContext(arrayCall("array.size", []), ringCtx())).toBe("array.size()");
    });

    it("ignores array.* whose first arg is not a bare identifier", () => {
        // The OUTER `array.size` over a non-identifier first arg falls through;
        // its inner `array.first(levels)` argument still lowers via the generic
        // recursion, so the result is `array.size(levels.at(0))`.
        expect(
            emitWithContext(
                arrayCall("array.size", [arrayCall("array.first", [ident("levels")])]),
                ringCtx(),
            ),
        ).toBe("array.size(levels.at(0))");
    });

    it("is a no-op when no handleRings are registered", () => {
        expect(emitWithContext(arrayCall("array.size", [ident("levels")]), ctx())).toBe(
            "array.size(levels)",
        );
    });
});

describe("inputCastType", () => {
    it("casts numeric factories to number", () => {
        expect(inputCastType("input.int(5)")).toBe("number");
        expect(inputCastType("input.float(1.5)")).toBe("number");
        expect(inputCastType("input.source(close)")).toBe("number");
        expect(inputCastType("input.enum(21, [21, 50])")).toBe("number");
    });

    it("casts the boolean factory to boolean", () => {
        expect(inputCastType("input.bool(true)")).toBe("boolean");
    });

    it("casts the string-valued factories (incl. input.color) to string", () => {
        expect(inputCastType('input.string("a")')).toBe("string");
        expect(inputCastType('input.interval("D")')).toBe("string");
        expect(inputCastType('input.color("#FF9800")')).toBe("string");
        expect(inputCastType('input.enum("a", ["a", "b"])')).toBe("string");
        expect(inputCastType('input.enum("Buy Signal", ["Buy Signal", "Sell Signal"])')).toBe(
            "string",
        );
    });

    it("leaves an unknown factory uncast", () => {
        expect(inputCastType("input.price(1)")).toBeNull();
    });
});

describe("buildDrawingEmitContext", () => {
    function contextFor(body: string): EmitContext {
        const src = `//@version=6\nindicator("X", overlay=true)\n${body}\nplot(close)\n`;
        const analysis = analyze(parseStatements(lex(src).tokens).script);
        const decl = analysis.script.declaration;
        if (
            decl === null ||
            decl.kind === "library-declaration" ||
            decl.kind === "import-declaration"
        ) {
            throw new Error("expected an indicator declaration");
        }
        const diagnostics = new DiagnosticCollector();
        const scaffold = transformDeclaration(decl, analysis, diagnostics);
        transformInputs(analysis, scaffold, diagnostics);
        for (const site of analysis.drawingSites) {
            if (site.camp.kind === "camp-b") {
                transformCampB(site, analysis, scaffold, diagnostics);
            }
        }
        return buildDrawingEmitContext(analysis, scaffold);
    }

    it("qualifies a registered input with its cast and maps a Camp B ring", () => {
        const ctx = contextFor(
            [
                "c = input.color(#FF9800)",
                "var array<line> lvls = array.new_line()",
                "if close > open",
                "    array.push(lvls, line.new(bar_index, close, bar_index, close))",
                "    if array.size(lvls) > 10",
                "        line.delete(array.shift(lvls))",
            ].join("\n"),
        );
        expect(ctx.inputNames.has("c")).toBe(true);
        expect(ctx.inputCasts?.get("c")).toBe("string");
        expect(ctx.handleRings?.get("lvls")).toBe("lvls");
        // No `var`/`varip` slots or UDF locals leak into the drawing context.
        expect(ctx.localNames.size).toBe(0);
        expect(ctx.stateSlots.size).toBe(0);
    });

    it("registers no handle rings when the script has none", () => {
        const ctx = contextFor("len = input.int(5)");
        expect(ctx.handleRings?.size).toBe(0);
        expect(ctx.inputCasts?.get("len")).toBe("number");
    });
});
