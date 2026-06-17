// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CallArgument, CallExpression, ExpressionNode } from "../ast/index.js";
import { enumLookup } from "../mapping/index.js";
import { namedArg, positionalArgs } from "./callArgs.js";
import type { ResolvedAnchor } from "./coordinates.js";
import { anchorToWorldPoint } from "./coordinates.js";
import type { AnnotationLookup } from "./exprEmit.js";
import { emitExpr } from "./exprEmit.js";
import { renderEnumTarget } from "./setterFold.js";
import { resolveYloc } from "./ylocResolve.js";

// The chartlang source for a Pine style argument: a bare-rooted enum
// (`color.red`) routes through `enumLookup`; everything else (a literal, an
// input reference) lowers via `emitExpr`.
function styleValueSource(node: ExpressionNode, annotations: AnnotationLookup): string {
    if (node.kind === "member-access-expression" && node.head === null) {
        const mapping = enumLookup(node.chain.join("."));
        if (mapping !== null) {
            const rendered = renderEnumTarget(mapping.chartlang);
            if (rendered !== null) {
                return rendered;
            }
        }
    }
    return emitExpr(node, annotations);
}

/**
 * The chartlang `draw.*` kind a converted handle binds to (`"line"`,
 * `"rectangle"`, `"text"`, `"marker"`, `"frame"`, `"arrow-mark-up"`,
 * `"arrow-mark-down"`). Mirrors the `DrawingState.kind` discriminators the
 * runtime understands; `synthesizeDrawCall` maps it to the camelCase
 * `draw.<method>` call name.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const k: ChartlangDrawKind = "line";
 *     void k;
 */
export type ChartlangDrawKind =
    | "line"
    | "rectangle"
    | "text"
    | "marker"
    | "frame"
    | "arrow-mark-up"
    | "arrow-mark-down";

// chartlang `DrawingState.kind` → the camelCase `draw.<method>` name.
const DRAW_METHOD: Readonly<Record<ChartlangDrawKind, string>> = {
    line: "line",
    rectangle: "rectangle",
    text: "text",
    marker: "marker",
    frame: "frame",
    "arrow-mark-up": "arrowMarkUp",
    "arrow-mark-down": "arrowMarkDown",
};

// The number of positional `WorldPoint` anchors each draw method consumes
// before its `body`/`opts` arguments. Single-anchor annotations take one;
// two-corner shapes take two.
const ANCHOR_ARITY: Readonly<Record<ChartlangDrawKind, 1 | 2>> = {
    line: 2,
    rectangle: 2,
    frame: 2,
    text: 1,
    marker: 1,
    "arrow-mark-up": 1,
    "arrow-mark-down": 1,
};

/**
 * The module-level slot local a Pine drawing handle binds to. A Pine
 * `var line lvl = na` handle becomes `__lvl_handle`; Task 16 codegen emits
 * the matching `const __lvl_handle = useDrawingHandleSlot<"line">();`
 * allocation and Camp A / Camp B reference this exact name in the compute
 * body. The naming is the cross-task contract — derive it here, never
 * inline the `__`/`_handle` affixes at a call site.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { handleSlotLocalName } from "./handleSlot.js";
 *     handleSlotLocalName("lvl"); // "__lvl_handle"
 */
export function handleSlotLocalName(pineName: string): string {
    return `__${pineName}_handle`;
}

/**
 * The diagnostics sink + lookups `synthesizeDrawCall` and the setter-fold
 * thread through: the per-node `naKind` annotations and the resolved
 * coordinate `anchors` side-table. A minimal structural sink keeps the
 * helper independent of the transform layer's `DiagnosticCollector`
 * concrete class so Camp A and Camp B share one signature.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const sink: DrawCallContext = {
 *         annotations: new Map(),
 *         anchors: new Map(),
 *         warn: () => {},
 *     };
 *     void sink;
 */
export type DrawCallContext = Readonly<{
    annotations: AnnotationLookup;
    anchors: ReadonlyMap<ExpressionNode, ResolvedAnchor>;
    warn: (
        code: "label-style-not-mapped" | "yloc-padding-approximated",
        node: ExpressionNode,
    ) => void;
}>;

// The chartlang string-literal source for a Pine string-literal node, or
// `null` when the node is not a plain string literal. The lexeme carries
// its surrounding quotes, so re-quote through JSON to normalise.
function stringLiteralSource(node: ExpressionNode): string | null {
    if (node.kind === "literal-expression" && node.literalKind === "string") {
        return JSON.stringify(node.value.slice(1, -1));
    }
    return null;
}

// Build the `WorldPoint` argument list for a draw call from the resolved
// anchor side-table. The coordinate resolver keys anchors by the x-coord
// argument node, so positional pairs `(x, y)` collapse to one anchor each.
// `ylocOverride`, when present, replaces the single annotation anchor's
// price (`yloc.abovebar/belowbar`).
function buildAnchorArgs(
    kind: ChartlangDrawKind,
    positional: readonly CallArgument[],
    ctx: DrawCallContext,
    ylocOverride: string | null,
): string[] {
    const arity = ANCHOR_ARITY[kind];
    const args: string[] = [];
    for (let i = 0; i < arity; i += 1) {
        const xArg = positional[i * 2];
        const resolved = xArg === undefined ? undefined : ctx.anchors.get(xArg.value);
        if (resolved === undefined) {
            args.push("{ time: bar.time, price: Number.NaN }");
            continue;
        }
        if (ylocOverride !== null && arity === 1) {
            args.push(`{ time: bar.time, price: ${ylocOverride} }`);
            continue;
        }
        args.push(anchorToWorldPoint(resolved));
    }
    return args;
}

// The chartlang style/options object source for a line / rectangle create
// call, gathered from the constructor's named style args via `enumLookup`.
// Returns `null` when no style arg is present (omit the opts argument).
function buildStyleOpts(
    kind: ChartlangDrawKind,
    args: readonly CallArgument[],
    ctx: DrawCallContext,
): string | null {
    const parts: string[] = [];
    const colorArg = namedArg(args, "color");
    if (colorArg !== null) {
        const field = kind === "rectangle" ? "stroke" : "color";
        parts.push(`${field}: ${styleValueSource(colorArg.value, ctx.annotations)}`);
    }
    const widthArg = namedArg(args, "width");
    if (widthArg !== null) {
        parts.push(`lineWidth: ${styleValueSource(widthArg.value, ctx.annotations)}`);
    }
    const styleArg = namedArg(args, "style");
    if (styleArg !== null && styleArg.value.kind === "member-access-expression") {
        const mapping = enumLookup(styleArg.value.chain.join("."));
        if (mapping !== null && typeof mapping.chartlang === "string") {
            parts.push(`lineStyle: ${JSON.stringify(mapping.chartlang)}`);
        }
    }
    return parts.length === 0 ? null : `{ ${parts.join(", ")} }`;
}

/**
 * Lower one Pine drawing `.new(...)` call into the chartlang
 * `draw.<method>(anchorA, [anchorB,] [body,] [opts])` expression source
 * (no trailing `;`). Camp A wraps the result in `slot.set(<call>)`; Camp B
 * wraps it in `ring.push(<call>)`. Coordinates come from the resolved
 * `anchors` side-table; style args route through `enumLookup`; `label.new`
 * supplies its `text` positional as the `draw.text` body and honours
 * `yloc.abovebar/belowbar`.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { synthesizeDrawCall } from "./handleSlot.js";
 *     declare const call: import("../ast/index.js").CallExpression;
 *     declare const ctx: import("./handleSlot.js").DrawCallContext;
 *     synthesizeDrawCall("line", call, ctx); // "draw.line({ … }, { … })"
 */
export function synthesizeDrawCall(
    kind: ChartlangDrawKind,
    call: CallExpression,
    ctx: DrawCallContext,
): string {
    const method = DRAW_METHOD[kind];
    const positional = positionalArgs(call.args);

    if (kind === "text" || kind === "frame") {
        const yloc = resolveYloc(call.args);
        if (yloc !== null) {
            ctx.warn("yloc-padding-approximated", call);
        }
        const anchors = buildAnchorArgs(kind, positional, ctx, yloc?.priceExpr ?? null);
        const textArg = positional[2];
        const body = textArg === undefined ? '""' : (stringLiteralSource(textArg.value) ?? '""');
        if (kind === "frame") {
            const label = `{ label: ${body} }`;
            return `draw.${method}(${anchors[0]}, ${anchors[0]}, ${label})`;
        }
        return `draw.${method}(${anchors[0]}, ${body})`;
    }

    if (kind === "marker" || kind === "arrow-mark-up" || kind === "arrow-mark-down") {
        const yloc = resolveYloc(call.args);
        if (yloc !== null) {
            ctx.warn("yloc-padding-approximated", call);
        }
        const anchors = buildAnchorArgs(kind, positional, ctx, yloc?.priceExpr ?? null);
        return `draw.${method}(${anchors[0]})`;
    }

    const anchors = buildAnchorArgs(kind, positional, ctx, null);
    const opts = buildStyleOpts(kind, call.args, ctx);
    const head = anchors.join(", ");
    return opts === null ? `draw.${method}(${head})` : `draw.${method}(${head}, ${opts})`;
}
