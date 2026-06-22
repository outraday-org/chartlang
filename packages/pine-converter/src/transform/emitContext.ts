// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CallExpression, ExpressionNode } from "../ast/index.js";
import type { AnnotationLookup } from "./exprEmit.js";
import { emitExpr } from "./exprEmit.js";
import { emitStr } from "./strFormat.js";

/**
 * The shared lowering context threaded through the control-flow / passthrough
 * transform. `annotations` feeds {@link emitExpr}; `inputNames` is the set of
 * registered chartlang input names (a bare identifier matching one rewrites
 * to `inputs.<name>`); `localNames` are the in-scope `let`/iterator/scalar
 * locals that SHADOW an input name (checked first so a local never gets the
 * `inputs.` prefix); `stateSlots` maps a Pine `var`/`varip` scalar name to
 * its chartlang `state.*` slot local (a read of one becomes `<slot>.value`).
 *
 * @since 0.1
 * @stable
 * @example
 *     const ctx: EmitContext = {
 *         annotations: new Map(),
 *         inputNames: new Set(["len"]),
 *         localNames: new Set(),
 *         stateSlots: new Map(),
 *     };
 *     void ctx;
 */
export type EmitContext = Readonly<{
    annotations: AnnotationLookup;
    inputNames: ReadonlySet<string>;
    localNames: ReadonlySet<string>;
    stateSlots: ReadonlyMap<string, string>;
    /**
     * Per-input-name TypeScript cast (`"number"`, `"boolean"`, …) applied to
     * an `inputs.<name>` read. chartlang types the `compute({ inputs })`
     * param loosely, so an `inputs.len` used as a number needs
     * `inputs.len as number` to type-check (the same cast chartlang's own
     * examples use). Absent (or no entry) → no cast.
     */
    inputCasts?: ReadonlyMap<string, string>;
    /**
     * Per-name replacement for a tuple-destructuring target — `macdLine` →
     * `macdLineResult.macd.current` — bound by a `[a, b, c] = ta.macd(...)`
     * statement (the result record is emitted once; each element reads a
     * `.current` scalar field). Absent (or no entry) → no rewrite.
     */
    tupleFieldAliases?: ReadonlyMap<string, string>;
    /**
     * Pine names of the `var`/`varip` scalars lowered to a `state.series` slot
     * (a numeric scalar that is history-indexed anywhere). A `[n]` history read
     * of one of these emits the BARE slot local (`<slot>[n]`, a real
     * `Series<number>` read), not the scalar `<slot>.value[n]` (a typecheck
     * error). A plain VALUE read still flows through `stateSlots` →
     * `<slot>.value` (a `state.series` is number-coercible and exposes
     * `.value`). Absent → no series slots.
     */
    seriesSlots?: ReadonlySet<string>;
    /**
     * Pine collection name → its chartlang `state.array` slot (local name +
     * literal capacity `K`), for a bounded numeric `var array<float|int>`
     * lowered to `state.array<number>(K)`. An `array.*(coll, …)` call over one
     * of these rewrites onto the slot's surface (`array.push(coll, v)` →
     * `<slot>.push(v)`, `array.get(coll, n)` → `<slot>.get(n)`,
     * `array.size(coll)` → `<slot>.size`, `array.last(coll)` → `<slot>.last()`,
     * `array.first(coll)` → `<slot>.get(<slot>.size - 1)`, `array.clear(coll)` →
     * `<slot>.clear()`). The capacity sizes a `for i = 0 to array.size(coll)`
     * walk's LITERAL loop bound (chartlang forbids a non-literal bound; the
     * slot's `get` gates the filled count internally). Absent → no array slots.
     */
    arraySlots?: ReadonlyMap<string, ArraySlotInfo>;
}>;

/**
 * A bounded numeric `state.array` slot: its chartlang local name and its
 * compile-time literal capacity `K`.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const info: ArraySlotInfo = { local: "win", cap: 20 };
 *     void info;
 */
export type ArraySlotInfo = Readonly<{ local: string; cap: number }>;

// The bare-rooted dotted callee of a call (`array.push`), or `null` for a
// computed callee. Local to the rewrite so `emitContext` stays self-contained.
function dottedCallee(callee: ExpressionNode): string | null {
    if (callee.kind === "member-access-expression" && callee.head === null) {
        return callee.chain.join(".");
    }
    return null;
}

// The chartlang `state.array` slot local a call's first argument targets, or
// `null` when the first arg is not a bare identifier naming a registered array
// slot.
function arraySlotOf(call: CallExpression, ctx: EmitContext): string | null {
    if (ctx.arraySlots === undefined) {
        return null;
    }
    const first = call.args[0]?.value;
    if (first === undefined || first.kind !== "identifier-expression") {
        return null;
    }
    return ctx.arraySlots.get(first.name)?.local ?? null;
}

// Rewrite an `array.*(coll, …)` call over a registered numeric array slot onto
// the slot's chartlang surface, returning the emitted source string. Arguments
// are lowered recursively so a nested rewrite still applies. Returns `null` for
// any call that is not an array-slot operation (the generic recursion handles
// it). An unrecognised `array.*` member over a slot also returns `null` —
// leaving it to the generic path — so a future array builtin never silently
// mis-lowers.
function rewriteArrayBuiltin(call: CallExpression, ctx: EmitContext): string | null {
    const slot = arraySlotOf(call, ctx);
    const name = dottedCallee(call.callee);
    if (slot === null || name === null) {
        return null;
    }
    const arg = (index: number): string => {
        const value = call.args[index]?.value;
        return value === undefined ? "" : emitWithContext(value, ctx);
    };
    switch (name) {
        case "array.push":
            return `${slot}.push(${arg(1)})`;
        case "array.get":
            return `${slot}.get(${arg(1)})`;
        case "array.size":
            return `${slot}.size`;
        case "array.last":
            return `${slot}.last()`;
        case "array.first":
            return `${slot}.get(${slot}.size - 1)`;
        case "array.clear":
            return `${slot}.clear()`;
        default:
            return null;
    }
}

// Rewrite a bare identifier per the context: a shadowing local stays verbatim;
// a `var`/`varip` scalar reads through its `state.*` slot's `.value`; a
// registered input name becomes `inputs.<name>`; anything else is untouched.
function rewriteIdentifier(name: string, ctx: EmitContext): string | null {
    if (ctx.localNames.has(name)) {
        return null;
    }
    const slot = ctx.stateSlots.get(name);
    if (slot !== undefined) {
        return `${slot}.value`;
    }
    const tupleField = ctx.tupleFieldAliases?.get(name);
    if (tupleField !== undefined) {
        return tupleField;
    }
    if (ctx.inputNames.has(name)) {
        const cast = ctx.inputCasts?.get(name);
        return cast === undefined ? `inputs.${name}` : `(inputs.${name} as ${cast})`;
    }
    return null;
}

// When `receiver` is a bare identifier naming a `state.series` slot, return a
// node carrying the bare slot LOCAL (so the enclosing `[n]` emits `<slot>[n]`,
// a real series index) — else `null` (the generic rewrite handles it, e.g. a
// scalar slot's `<slot>.value` or an OHLCV `bar.close`). A non-series-slot
// receiver flows through `rewriteTree` unchanged.
function seriesSlotReceiver(receiver: ExpressionNode, ctx: EmitContext): ExpressionNode | null {
    if (
        receiver.kind !== "identifier-expression" ||
        ctx.seriesSlots === undefined ||
        !ctx.seriesSlots.has(receiver.name)
    ) {
        return null;
    }
    const slot = ctx.stateSlots.get(receiver.name);
    return slot === undefined ? null : { ...receiver, name: slot };
}

// Recursively apply the identifier rewrite across an expression tree, then
// hand the rewritten tree to `emitExpr`. Only `identifier-expression` nodes
// whose name resolves to an input / state slot are replaced; every other node
// is structurally preserved so `emitExpr`'s own remaps (OHLCV, `na`, operators)
// still run.
function rewriteTree(node: ExpressionNode, ctx: EmitContext): ExpressionNode {
    switch (node.kind) {
        case "identifier-expression": {
            const replacement = rewriteIdentifier(node.name, ctx);
            return replacement === null ? node : { ...node, name: replacement };
        }
        case "unary-expression":
            return { ...node, operand: rewriteTree(node.operand, ctx) };
        case "binary-expression":
            return {
                ...node,
                left: rewriteTree(node.left, ctx),
                right: rewriteTree(node.right, ctx),
            };
        case "ternary-expression":
            return {
                ...node,
                condition: rewriteTree(node.condition, ctx),
                consequent: rewriteTree(node.consequent, ctx),
                alternate: rewriteTree(node.alternate, ctx),
            };
        case "call-expression": {
            // Lower an `array.*(coll, …)` operation over a numeric `state.array`
            // slot onto the slot's surface (`array.push(coll, v)` →
            // `<slot>.push(v)`). Spliced as a verbatim identifier so `emitExpr`
            // re-emits it as-is; a non-array-slot call falls through.
            const arrayLowered = rewriteArrayBuiltin(node, ctx);
            if (arrayLowered !== null) {
                return { kind: "identifier-expression", name: arrayLowered, span: node.span };
            }
            // Lower a `str.*` call wherever it appears (a cell text, a plot
            // title, a binary operand) — `emitExpr` alone would leak the
            // undefined `str` identifier. The lowered source is spliced as a
            // verbatim identifier so `emitExpr` re-emits it as-is; an unmapped
            // `str.*` form falls through to the structural rewrite.
            const lowered = emitStr(node, ctx);
            if (lowered !== null && lowered.kind === "code") {
                return { kind: "identifier-expression", name: lowered.source, span: node.span };
            }
            return {
                ...node,
                callee: rewriteTree(node.callee, ctx),
                args: node.args.map((arg) => ({ ...arg, value: rewriteTree(arg.value, ctx) })),
            };
        }
        case "member-access-expression":
            return node.head === null ? node : { ...node, head: rewriteTree(node.head, ctx) };
        case "history-access-expression": {
            // A `[n]` read of a `state.series` slot emits the BARE slot local
            // (`<slot>[n]`, a real series index), not the `.value`-rewritten
            // scalar (`<slot>.value[n]`, a typecheck error). The offset still
            // rewrites normally; the receiver of every OTHER history form is
            // rewritten by the generic recursion.
            const seriesReceiver = seriesSlotReceiver(node.receiver, ctx);
            return {
                ...node,
                receiver:
                    seriesReceiver === null ? rewriteTree(node.receiver, ctx) : seriesReceiver,
                offset: rewriteTree(node.offset, ctx),
            };
        }
        case "paren-expression":
            return { ...node, expression: rewriteTree(node.expression, ctx) };
        case "tuple-expression":
            return { ...node, elements: node.elements.map((el) => rewriteTree(el, ctx)) };
        case "lambda-expression":
            return { ...node, body: rewriteTree(node.body, ctx) };
        default:
            return node;
    }
}

/**
 * Lower a Pine expression to a chartlang TS source string, with the
 * input-reference and `state.*` slot rewrites of an {@link EmitContext}
 * applied. Wraps {@link emitExpr}: a bare identifier that names a registered
 * input becomes `inputs.<name>` and a `var`/`varip` scalar becomes
 * `<slot>.value`, unless a same-named local shadows it.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { emitWithContext } from "./emitContext.js";
 *     const ctx = {
 *         annotations: new Map(),
 *         inputNames: new Set(["len"]),
 *         localNames: new Set<string>(),
 *         stateSlots: new Map<string, string>(),
 *     };
 *     const node = {
 *         kind: "identifier-expression",
 *         name: "len",
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 4 },
 *     } as const;
 *     emitWithContext(node, ctx); // "inputs.len"
 */
export function emitWithContext(node: ExpressionNode, ctx: EmitContext): string {
    return emitExpr(rewriteTree(node, ctx), ctx.annotations);
}
