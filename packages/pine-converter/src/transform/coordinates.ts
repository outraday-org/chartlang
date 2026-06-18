// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    CallArgument,
    CallExpression,
    ExpressionNode,
    MemberAccessExpression,
} from "../ast/index.js";
import { makeDiagnostic } from "../diagnostics/codes.js";
import type { Diagnostic, SourceSpan } from "../index.js";
import type { ConvertOpts } from "../index.js";
import type { DrawingCallSite, SemanticResult } from "../semantic/index.js";
import { namedArg, positionalArgs } from "./callArgs.js";
import type { AnnotationLookup } from "./exprEmit.js";
import { emitExpr } from "./exprEmit.js";

/**
 * The resolved coordinate IR for one coordinate-bearing expression. `*Expr`
 * fields are chartlang TypeScript source strings the Task 16 codegen emits
 * verbatim; `offsetExpr` is the bar offset for the historical / future /
 * index forms, lowered to `bar.point(<signed offset>, <price>)` (the runtime
 * resolves it to a real / extrapolated time). `requiresBarInterval` remains on
 * the future-bar arm as a manifest signal that the script anchors ahead of the
 * last bar.
 *
 * @since 0.1
 * @stable
 * @example
 *     const a: ResolvedAnchor = { kind: "bar-index-historical", offsetExpr: "0", priceExpr: "bar.close" };
 *     void a;
 */
export type ResolvedAnchor =
    | { readonly kind: "literal-world-point"; readonly time: number; readonly price: number }
    | { readonly kind: "expr-world-point"; readonly timeExpr: string; readonly priceExpr: string }
    | {
          readonly kind: "bar-index-historical";
          readonly offsetExpr: string;
          readonly priceExpr: string;
      }
    | {
          readonly kind: "bar-index-future";
          readonly offsetExpr: string;
          readonly priceExpr: string;
          readonly requiresBarInterval: true;
      }
    | { readonly kind: "bar-time-direct"; readonly timeExpr: string; readonly priceExpr: string }
    | { readonly kind: "chart-point-now"; readonly priceExpr: string }
    | {
          readonly kind: "chart-point-from-index";
          readonly offsetExpr: string;
          readonly priceExpr: string;
      }
    | {
          readonly kind: "chart-point-from-time";
          readonly timeExpr: string;
          readonly priceExpr: string;
      }
    | {
          readonly kind: "chart-point-new";
          readonly timeExpr: string;
          readonly offsetExpr: string;
          readonly priceExpr: string;
      };

/**
 * The coordinate-resolution side-table plus the diagnostics it raised. The
 * `anchors` map is keyed by the source coordinate expression so Task 16 can
 * look up how to emit each `WorldPoint`. The AST is never mutated.
 *
 * @since 0.1
 * @stable
 * @example
 *     const r: CoordinateResolution = { anchors: new Map(), diagnostics: [] };
 *     void r;
 */
export type CoordinateResolution = Readonly<{
    anchors: ReadonlyMap<ExpressionNode, ResolvedAnchor>;
    diagnostics: readonly Diagnostic[];
}>;

// Coordinate-argument layout per recognised drawing constructor. Each entry
// is a list of (xExpr, yExpr) positional argument-index pairs. `table.new`
// and `linefill.new` carry no `(time, price)` coordinates and are absent.
const COORD_LAYOUT: ReadonlyMap<string, readonly (readonly [number, number])[]> = new Map([
    ["line.new", [[0, 1] as const, [2, 3] as const]],
    ["box.new", [[0, 1] as const, [2, 3] as const]],
    ["label.new", [[0, 1] as const]],
]);

// A bar-offset anchor as a `bar.point(<signed offset>, <price>)` call. The
// runtime resolves the offset to a real (historical) or extrapolated (future)
// timestamp at compute time, so the converter no longer synthesises bar-time
// arithmetic or carries a `__BAR_INTERVAL_MS` sentinel. Historical offsets are
// negated (`bar.point(-(N), …)`), future offsets stay positive
// (`bar.point((N), …)`), and offset `"0"` is the current bar (`bar.point(0,
// …)`).
function barPoint(offsetExpr: string, priceExpr: string, future: boolean): string {
    if (offsetExpr === "0") {
        return `bar.point(0, ${priceExpr})`;
    }
    const signed = future ? `(${offsetExpr})` : `-(${offsetExpr})`;
    return `bar.point(${signed}, ${priceExpr})`;
}

/**
 * Render a resolved {@link ResolvedAnchor} to a chartlang `WorldPoint`
 * source string. Bar-offset anchors lower to a `bar.point(<signed offset>,
 * <price>)` call — index authoring sugar that the runtime resolves to a real
 * (historical) or extrapolated (future) timestamp; explicit-time anchors stay
 * `{ time, price }` object literals. Shared by the Camp A / Camp B draw-call
 * synthesis and setter-fold so every anchor lowers identically.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { anchorToWorldPoint } from "./coordinates.js";
 *     anchorToWorldPoint({
 *         kind: "bar-index-historical",
 *         offsetExpr: "0",
 *         priceExpr: "bar.close",
 *     });
 *     // "bar.point(0, bar.close)"
 */
export function anchorToWorldPoint(anchor: ResolvedAnchor): string {
    switch (anchor.kind) {
        case "literal-world-point":
            return `{ time: ${anchor.time}, price: ${anchor.price} }`;
        case "expr-world-point":
        case "bar-time-direct":
        case "chart-point-from-time":
            return `{ time: ${anchor.timeExpr}, price: ${anchor.priceExpr} }`;
        case "bar-index-historical":
        case "chart-point-from-index":
            return barPoint(anchor.offsetExpr, anchor.priceExpr, false);
        case "bar-index-future":
            return barPoint(anchor.offsetExpr, anchor.priceExpr, true);
        case "chart-point-now":
            return `bar.point(0, ${anchor.priceExpr})`;
        case "chart-point-new":
            return `{ time: ${anchor.timeExpr}, price: ${anchor.priceExpr} }`;
    }
}

function unwrapParens(node: ExpressionNode): ExpressionNode {
    let current = node;
    while (current.kind === "paren-expression") {
        current = current.expression;
    }
    return current;
}

// The dotted built-in name of a bare-rooted member chain (`xloc.bar_time`),
// or `null` for any other expression.
function memberChainName(node: ExpressionNode): string | null {
    if (node.kind === "member-access-expression" && node.head === null) {
        return node.chain.join(".");
    }
    return null;
}

function isBareBarIndex(node: ExpressionNode): boolean {
    return node.kind === "identifier-expression" && node.name === "bar_index";
}

// A `bar_index` receiver with a literal integer offset (`bar_index[N]`),
// returning N (>= 0) or `null` when the shape doesn't match.
function literalHistoryOffset(node: ExpressionNode): number | null {
    if (node.kind !== "history-access-expression" || !isBareBarIndex(node.receiver)) {
        return null;
    }
    const offset = unwrapParens(node.offset);
    if (offset.kind === "literal-expression" && offset.literalKind === "int") {
        return Number.parseInt(offset.value, 10);
    }
    return null;
}

// A literal positive integer from a `+`/`-` right operand, or `null`.
function literalInt(node: ExpressionNode): number | null {
    const inner = unwrapParens(node);
    if (inner.kind === "literal-expression" && inner.literalKind === "int") {
        const value = Number.parseInt(inner.value, 10);
        return value > 0 ? value : null;
    }
    return null;
}

type XlocMode = "bar-index" | "bar-time";

function resolveXloc(args: readonly CallArgument[]): XlocMode {
    const arg = namedArg(args, "xloc");
    if (arg !== null && memberChainName(arg.value) === "xloc.bar_time") {
        return "bar-time";
    }
    return "bar-index";
}

interface ResolveCtx {
    // Only `annotations` is read through the ctx (`emit` → `emitExpr`); the
    // single-anchor `resolveAnchorExpr` path has nothing else to give, so the
    // field is narrowed to exactly what is consumed (a full `SemanticResult`
    // is assignable from the site-sweep path).
    readonly result: Pick<SemanticResult, "annotations">;
    readonly opts: ConvertOpts;
    readonly anchors: Map<ExpressionNode, ResolvedAnchor>;
    readonly diagnostics: Diagnostic[];
    futureWithoutInterval: SourceSpan | null;
}

function emit(ctx: ResolveCtx, node: ExpressionNode): string {
    return emitExpr(node, ctx.result.annotations);
}

function noteFuture(ctx: ResolveCtx, span: SourceSpan): void {
    if (ctx.opts.barInterval == null && ctx.futureWithoutInterval === null) {
        ctx.futureWithoutInterval = span;
    }
}

// Resolve a `bar_index`-mode x-expression into the matching anchor kind.
function resolveBarIndexAnchor(
    ctx: ResolveCtx,
    xExpr: ExpressionNode,
    priceExpr: string,
): ResolvedAnchor {
    const x = unwrapParens(xExpr);

    if (isBareBarIndex(x)) {
        return { kind: "bar-index-historical", offsetExpr: "0", priceExpr };
    }

    const historyOffset = literalHistoryOffset(x);
    if (historyOffset !== null) {
        return { kind: "bar-index-historical", offsetExpr: String(historyOffset), priceExpr };
    }

    if (x.kind === "binary-expression" && isBareBarIndex(unwrapParens(x.left))) {
        const literal = literalInt(x.right);
        if (x.operator === "+" && literal !== null) {
            noteFuture(ctx, x.span);
            return {
                kind: "bar-index-future",
                offsetExpr: String(literal),
                priceExpr,
                requiresBarInterval: true,
            };
        }
        if (x.operator === "-" && literal !== null) {
            return { kind: "bar-index-historical", offsetExpr: String(literal), priceExpr };
        }
        if (x.operator === "+" || x.operator === "-") {
            ctx.diagnostics.push(makeDiagnostic("dynamic-bar-index", x.span));
            const offsetExpr = emit(ctx, x.right);
            if (x.operator === "+") {
                // A DYNAMIC (non-literal) `+` offset is resolved by
                // `bar.point` at runtime sign-agnostically: a negative
                // runtime offset (e.g. what `ta.highestbars` returns)
                // resolves to the historical timestamp via the time
                // buffer, a positive one extrapolates from bar spacing.
                // Neither path needs `opts.barInterval`, so this case
                // does NOT `noteFuture` — only the literal `bar_index + N`
                // future case does. We still emit the `bar-index-future`
                // anchor so the runtime's offset-sign branch does the
                // right thing.
                return {
                    kind: "bar-index-future",
                    offsetExpr,
                    priceExpr,
                    requiresBarInterval: true,
                };
            }
            return { kind: "bar-index-historical", offsetExpr, priceExpr };
        }
    }

    ctx.diagnostics.push(makeDiagnostic("unresolved-bar-index", x.span));
    return { kind: "bar-index-historical", offsetExpr: "0", priceExpr };
}

// `chart.point.now` / `from_index` / `from_time` / `new` factory call.
function chartPointFactory(node: ExpressionNode): { factory: string; call: CallExpression } | null {
    if (node.kind !== "call-expression") {
        return null;
    }
    const callee: ExpressionNode = node.callee;
    if (callee.kind !== "member-access-expression" || callee.head !== null) {
        return null;
    }
    const [root, member, factory] = (callee as MemberAccessExpression).chain;
    if (root === "chart" && member === "point" && factory !== undefined) {
        return { factory, call: node };
    }
    return null;
}

function resolveChartPoint(ctx: ResolveCtx, factory: string, call: CallExpression): ResolvedAnchor {
    const args = positionalArgs(call.args);
    const at = (i: number): ExpressionNode | null => args[i]?.value ?? null;

    if (factory === "now") {
        const price = at(0);
        return {
            kind: "chart-point-now",
            priceExpr: price === null ? "Number.NaN" : emit(ctx, price),
        };
    }
    if (factory === "from_index") {
        return {
            kind: "chart-point-from-index",
            offsetExpr: at(0) === null ? "0" : emit(ctx, at(0) as ExpressionNode),
            priceExpr: at(1) === null ? "Number.NaN" : emit(ctx, at(1) as ExpressionNode),
        };
    }
    if (factory === "from_time") {
        return {
            kind: "chart-point-from-time",
            timeExpr: at(0) === null ? "Number.NaN" : emit(ctx, at(0) as ExpressionNode),
            priceExpr: at(1) === null ? "Number.NaN" : emit(ctx, at(1) as ExpressionNode),
        };
    }
    // chart.point.new(time, index, price)
    return {
        kind: "chart-point-new",
        timeExpr: at(0) === null ? "Number.NaN" : emit(ctx, at(0) as ExpressionNode),
        offsetExpr: at(1) === null ? "0" : emit(ctx, at(1) as ExpressionNode),
        priceExpr: at(2) === null ? "Number.NaN" : emit(ctx, at(2) as ExpressionNode),
    };
}

function isNumericLiteral(node: ExpressionNode): boolean {
    const inner = unwrapParens(node);
    if (inner.kind === "literal-expression") {
        return inner.literalKind === "int" || inner.literalKind === "float";
    }
    return (
        inner.kind === "unary-expression" &&
        (inner.operator === "+" || inner.operator === "-") &&
        unwrapParens(inner.operand).kind === "literal-expression"
    );
}

// Numeric value of a node already validated by `isNumericLiteral` — a
// (possibly paren-wrapped) numeric literal or a `+`/`-` prefix of one.
function literalNumber(node: ExpressionNode): number {
    const inner = unwrapParens(node);
    if (inner.kind === "literal-expression") {
        return Number.parseFloat(inner.value);
    }
    // The only other shape `isNumericLiteral` admits is a `+`/`-` unary.
    const unary = inner as Extract<ExpressionNode, { kind: "unary-expression" }>;
    const value = literalNumber(unary.operand);
    return unary.operator === "-" ? -value : value;
}

// Resolve one (x, y) coordinate pair under the call-site's `xloc` mode.
function resolvePair(
    ctx: ResolveCtx,
    keyNode: ExpressionNode,
    xExpr: ExpressionNode,
    yExpr: ExpressionNode,
    xloc: XlocMode,
): void {
    const point = chartPointFactory(xExpr);
    if (point !== null) {
        ctx.anchors.set(keyNode, resolveChartPoint(ctx, point.factory, point.call));
        return;
    }

    const priceExpr = emit(ctx, yExpr);

    if (isNumericLiteral(xExpr) && isNumericLiteral(yExpr) && xloc === "bar-time") {
        ctx.anchors.set(keyNode, {
            kind: "literal-world-point",
            time: literalNumber(xExpr),
            price: literalNumber(yExpr),
        });
        return;
    }

    if (xloc === "bar-time") {
        ctx.anchors.set(keyNode, {
            kind: "bar-time-direct",
            timeExpr: emit(ctx, xExpr),
            priceExpr,
        });
        return;
    }

    ctx.anchors.set(keyNode, resolveBarIndexAnchor(ctx, xExpr, priceExpr));
}

/**
 * Resolve a single `(x, y)` coordinate pair into a {@link ResolvedAnchor}
 * outside the drawing-site sweep — used by the Camp A / Camp B setter-fold
 * (Task 10/11), whose `set_xy1(handle, x, y)` arguments carry the same
 * `bar_index` / `bar_time` / `chart.point` coordinate forms but are not
 * part of the `.new()` constructor scan. Diagnostics are NOT raised here:
 * the `.new()` site pass already reports coordinate issues for the script,
 * so a setter re-anchoring the same handle does not double-report.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { resolveAnchorExpr } from "./coordinates.js";
 *     const x = {
 *         kind: "identifier-expression",
 *         name: "bar_index",
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
 *     } as const;
 *     const y = {
 *         kind: "identifier-expression",
 *         name: "close",
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
 *     } as const;
 *     resolveAnchorExpr(x, y, new Map()).kind; // "bar-index-historical"
 */
export function resolveAnchorExpr(
    xExpr: ExpressionNode,
    yExpr: ExpressionNode,
    annotations: AnnotationLookup,
    opts: ConvertOpts = {},
): ResolvedAnchor {
    const anchors = new Map<ExpressionNode, ResolvedAnchor>();
    const ctx: ResolveCtx = {
        result: { annotations },
        opts,
        anchors,
        diagnostics: [],
        futureWithoutInterval: null,
    };
    resolvePair(ctx, xExpr, xExpr, yExpr, "bar-index");
    // `resolvePair` always sets the key node; the lookup is total.
    return [...anchors.values()][0];
}

function resolveDrawingSite(ctx: ResolveCtx, site: DrawingCallSite): void {
    const layout = COORD_LAYOUT.get(site.constructor);
    if (layout === undefined) {
        // table.new / linefill.new / polyline.new have no (time, price) pairs
        // here; polyline points are resolved via their chart.point factory
        // calls in a dedicated transform task.
        return;
    }
    const xloc = resolveXloc(site.call.args);
    const positional = positionalArgs(site.call.args);
    for (const [xi, yi] of layout) {
        const xArg = positional[xi];
        const yArg = positional[yi];
        if (xArg === undefined || yArg === undefined) {
            continue;
        }
        resolvePair(ctx, xArg.value, xArg.value, yArg.value, xloc);
    }
}

/**
 * Resolve every coordinate-bearing expression in a {@link SemanticResult}
 * to a {@link ResolvedAnchor}, returning the side-table plus the
 * diagnostics raised. The AST is not mutated. When a future `bar_index + N`
 * anchor is produced but `opts.barInterval` is `null`, a single
 * `requires-bar-interval` error is raised at the first offending anchor.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { resolveCoordinates } from "./coordinates.js";
 *     declare const semantic: import("../semantic/index.js").SemanticResult;
 *     const { anchors, diagnostics } = resolveCoordinates(semantic, { barInterval: 60_000 });
 *     void anchors;
 *     void diagnostics;
 */
export function resolveCoordinates(
    result: SemanticResult,
    opts: ConvertOpts = {},
): CoordinateResolution {
    const ctx: ResolveCtx = {
        result,
        opts,
        anchors: new Map(),
        diagnostics: [],
        futureWithoutInterval: null,
    };

    for (const site of result.drawingSites) {
        resolveDrawingSite(ctx, site);
    }

    if (ctx.futureWithoutInterval !== null) {
        ctx.diagnostics.push(makeDiagnostic("requires-bar-interval", ctx.futureWithoutInterval));
    }

    return { anchors: ctx.anchors, diagnostics: ctx.diagnostics };
}
