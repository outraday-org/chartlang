// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CallArgument, CallExpression, ExpressionNode } from "../ast/index.js";
import { enumLookup } from "../mapping/index.js";
import type { DiagnosticCollector } from "./diagnosticCollector.js";
import type { EmitContext } from "./emitContext.js";
import { emitWithContext } from "./emitContext.js";

// Lower a styling value: a bare-rooted `color.*`/enum member routes through
// `enumLookup` (so `color.red` → `"#FF5252"`), everything else through the
// input-aware expression emitter.
function styleValue(node: ExpressionNode, ctx: EmitContext): string {
    if (node.kind === "member-access-expression" && node.head === null) {
        const mapping = enumLookup(node.chain.join("."));
        if (mapping !== null && typeof mapping.chartlang === "string") {
            return JSON.stringify(mapping.chartlang);
        }
    }
    return emitWithContext(node, ctx);
}

// The plot-family bare callees this transform recognises.
const PLOT_FAMILY: ReadonlySet<string> = new Set([
    "plot",
    "plotshape",
    "plotchar",
    "plotcandle",
    "plotbar",
    "plotarrow",
    "hline",
    "bgcolor",
    "barcolor",
    "fill",
]);

// The bare callee name (`plot`) of a call, or `null` for a member/computed
// callee (the plot family is always a bare identifier in Pine).
function bareCallee(call: CallExpression): string | null {
    return call.callee.kind === "identifier-expression" ? call.callee.name : null;
}

/**
 * Whether a call is a member of the Pine plot family (`plot`, `plotshape`,
 * `plotchar`, `plotcandle`, `plotbar`, `plotarrow`, `hline`, `bgcolor`,
 * `barcolor`, `fill`). Lets the caller route the statement to
 * {@link emitPlotFamily} and skip the generic expression-statement path.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { isPlotFamilyCall } from "./plotFamily.js";
 *     const call = {
 *         kind: "call-expression",
 *         callee: {
 *             kind: "identifier-expression",
 *             name: "plot",
 *             span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 5 },
 *         },
 *         args: [],
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 7 },
 *     } as const;
 *     isPlotFamilyCall(call); // true
 */
export function isPlotFamilyCall(call: CallExpression): boolean {
    const name = bareCallee(call);
    return name !== null && PLOT_FAMILY.has(name);
}

// The positional (unnamed) args of a call in source order.
function positional(args: readonly CallArgument[]): readonly ExpressionNode[] {
    return args.filter((arg) => arg.name === null).map((arg) => arg.value);
}

// The value of a named arg by key, or `null` when absent.
function named(args: readonly CallArgument[], key: string): ExpressionNode | null {
    return args.find((arg) => arg.name === key)?.value ?? null;
}

// Build the `{ k: v, … }` options object from the (key, rendered-value) pairs
// whose value is present, or the empty string when none are.
function options(pairs: ReadonlyArray<readonly [string, string | null]>): string {
    const parts: string[] = [];
    for (const [key, value] of pairs) {
        if (value !== null) {
            parts.push(`${key}: ${value}`);
        }
    }
    return parts.length === 0 ? "" : `{ ${parts.join(", ")} }`;
}

// Render the title / color / lineWidth options shared by `plot` and `hline`.
// `title` falls back to the second positional; `color` routes through the enum
// resolver; `lineWidth` takes the named arg or the fourth positional.
function commonOptions(
    args: readonly CallArgument[],
    pos: readonly ExpressionNode[],
    ctx: EmitContext,
): string {
    const titleNode = named(args, "title") ?? pos[1] ?? null;
    const colorNode = named(args, "color") ?? pos[2] ?? null;
    const widthNode = named(args, "linewidth") ?? pos[3] ?? null;
    return options([
        ["title", titleNode === null ? null : emitWithContext(titleNode, ctx)],
        ["color", colorNode === null ? null : styleValue(colorNode, ctx)],
        ["lineWidth", widthNode === null ? null : emitWithContext(widthNode, ctx)],
    ]);
}

/**
 * Lower a Pine plot-family call into a chartlang `plot(...)` / `hline(...)`
 * statement string, or push a reject diagnostic. `plot` maps title/color/
 * linewidth onto a `{ ... }` options object; `plotshape`/`plotchar`/
 * `plotarrow` gate the value behind their condition (`cond ? value : NaN`)
 * and select a `style.kind`; `bgcolor`/`barcolor` emit a `plot(NaN, { style
 * })` background; `hline` maps to chartlang `hline(price, { ... })`. `fill`
 * has no chartlang analogue and pushes `fill-not-mapped`. Returns `null` for
 * a non-plot-family call.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { emitPlotFamily } from "./plotFamily.js";
 *     import { DiagnosticCollector } from "./diagnosticCollector.js";
 *     const ctx = {
 *         annotations: new Map(),
 *         inputNames: new Set<string>(),
 *         localNames: new Set<string>(),
 *         stateSlots: new Map<string, string>(),
 *     };
 *     const call = {
 *         kind: "call-expression",
 *         callee: {
 *             kind: "identifier-expression",
 *             name: "plot",
 *             span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 5 },
 *         },
 *         args: [
 *             {
 *                 name: null,
 *                 value: {
 *                     kind: "identifier-expression",
 *                     name: "close",
 *                     span: { startLine: 1, startColumn: 6, endLine: 1, endColumn: 11 },
 *                 },
 *                 span: { startLine: 1, startColumn: 6, endLine: 1, endColumn: 11 },
 *             },
 *         ],
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 12 },
 *     } as const;
 *     emitPlotFamily(call, ctx, new DiagnosticCollector()); // "plot(bar.close);"
 */
export function emitPlotFamily(
    call: CallExpression,
    ctx: EmitContext,
    diagnostics: DiagnosticCollector,
): string | null {
    const name = bareCallee(call);
    if (name === null || !PLOT_FAMILY.has(name)) {
        return null;
    }
    const pos = positional(call.args);
    switch (name) {
        case "plot":
            return emitPlot(call.args, pos, ctx);
        case "plotshape":
        case "plotchar":
        case "plotarrow":
            return emitConditional(name, call.args, pos, ctx);
        case "plotcandle":
            return emitCandle(pos, ctx);
        case "plotbar":
            return emitBar(call.args, ctx);
        case "hline":
            return emitHline(call.args, pos, ctx);
        case "bgcolor":
            return emitBackground("bg-color", pos, ctx);
        case "barcolor":
            return emitBackground("bar-color", pos, ctx);
        default:
            diagnostics.pushCode("fill-not-mapped", call.span);
            return null;
    }
}

function emitPlot(
    args: readonly CallArgument[],
    pos: readonly ExpressionNode[],
    ctx: EmitContext,
): string | null {
    const value = pos[0];
    if (value === undefined) {
        return null;
    }
    const opts = commonOptions(args, pos, ctx);
    const valueSource = emitWithContext(value, ctx);
    return opts === "" ? `plot(${valueSource});` : `plot(${valueSource}, ${opts});`;
}

function emitConditional(
    name: "plotshape" | "plotchar" | "plotarrow",
    args: readonly CallArgument[],
    pos: readonly ExpressionNode[],
    ctx: EmitContext,
): string | null {
    const condition = pos[0];
    if (condition === undefined) {
        return null;
    }
    const cond = emitWithContext(condition, ctx);
    const styleKind = name === "plotshape" ? "shape" : name === "plotchar" ? "character" : "arrow";
    const styleParts: string[] = [`kind: "${styleKind}"`];
    const colorNode = named(args, "color");
    if (colorNode !== null) {
        styleParts.push(`color: ${styleValue(colorNode, ctx)}`);
    }
    if (name === "plotchar") {
        const charNode = named(args, "char");
        if (charNode !== null) {
            styleParts.push(`char: ${emitWithContext(charNode, ctx)}`);
        }
    }
    return `plot(${cond} ? bar.close : Number.NaN, { style: { ${styleParts.join(", ")} } });`;
}

function emitCandle(pos: readonly ExpressionNode[], ctx: EmitContext): string | null {
    const open = pos[0];
    const high = pos[1];
    const low = pos[2];
    const close = pos[3];
    if (open === undefined || high === undefined || low === undefined || close === undefined) {
        return null;
    }
    return `plot(${emitWithContext(close, ctx)}, { style: { kind: "candle-override" } });`;
}

function emitBar(args: readonly CallArgument[], ctx: EmitContext): string | null {
    const colorNode = named(args, "color");
    const colorPart = colorNode === null ? "" : `, color: ${styleValue(colorNode, ctx)}`;
    return `plot(Number.NaN, { style: { kind: "bar-override"${colorPart} } });`;
}

function emitHline(
    args: readonly CallArgument[],
    pos: readonly ExpressionNode[],
    ctx: EmitContext,
): string | null {
    const price = pos[0];
    if (price === undefined) {
        return null;
    }
    const opts = commonOptions(args, pos, ctx);
    const priceSource = emitWithContext(price, ctx);
    return opts === "" ? `hline(${priceSource});` : `hline(${priceSource}, ${opts});`;
}

function emitBackground(
    kind: "bg-color" | "bar-color",
    pos: readonly ExpressionNode[],
    ctx: EmitContext,
): string | null {
    const color = pos[0];
    if (color === undefined) {
        return null;
    }
    return `plot(Number.NaN, { style: { kind: "${kind}", color: ${styleValue(color, ctx)} } });`;
}
