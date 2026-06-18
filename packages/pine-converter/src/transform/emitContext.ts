// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ExpressionNode } from "../ast/index.js";
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
}>;

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
        case "history-access-expression":
            return {
                ...node,
                receiver: rewriteTree(node.receiver, ctx),
                offset: rewriteTree(node.offset, ctx),
            };
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
