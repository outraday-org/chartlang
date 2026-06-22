// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CallArgument, CallExpression, ExpressionNode } from "../ast/index.js";
import { enumLookup } from "../mapping/index.js";
import { dottedCallee } from "./callArgs.js";
import type { DiagnosticCollector } from "./diagnosticCollector.js";
import type { EmitContext } from "./emitContext.js";
import { emitWithContext } from "./emitContext.js";

// Lower a styling value: a bare-rooted `color.*`/enum member routes through
// `enumLookup` (so `color.red` → `"#FF5252"`), everything else through the
// input-aware expression emitter. A per-bar conditional color
// (`close > open ? color.green : color.red`) recurses through the ternary
// branches (and paren grouping) so each color leaf resolves while the
// condition flows through the normal emitter — the dynamic-color expression
// `bgcolor`/`barcolor` carry through to the `colorValue` channel.
function styleValue(node: ExpressionNode, ctx: EmitContext): string {
    if (node.kind === "member-access-expression" && node.head === null) {
        const mapping = enumLookup(node.chain.join("."));
        if (mapping !== null && typeof mapping.chartlang === "string") {
            return JSON.stringify(mapping.chartlang);
        }
    }
    if (node.kind === "paren-expression") {
        return `(${styleValue(node.expression, ctx)})`;
    }
    if (node.kind === "ternary-expression") {
        const cond = emitWithContext(node.condition, ctx);
        const yes = styleValue(node.consequent, ctx);
        const no = styleValue(node.alternate, ctx);
        return `${cond} ? ${yes} : ${no}`;
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
 * @stable
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
 * and select a `style.kind`; `bgcolor`/`barcolor` emit the Pine-ergonomic
 * `bgcolor(<color>)` / `barcolor(<color>)` sugar carrying the real per-bar
 * color expression (Deliverable-2 dynamic-color channel); `hline` maps to
 * chartlang `hline(price, { ... })`. `fill`
 * has no chartlang analogue and pushes `fill-not-mapped`. Returns `null` for
 * a non-plot-family call.
 *
 * @since 0.1
 * @stable
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
            return emitPlot(call.args, pos, ctx, diagnostics);
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
            return emitBackground("bgcolor", call.args, pos, ctx);
        case "barcolor":
            return emitBackground("barcolor", call.args, pos, ctx);
        default:
            diagnostics.pushCode("fill-not-mapped", call.span);
            return null;
    }
}

// Whether a node is the literal `0` (any `0`/`0.0` numeric literal). A
// `plot(..., offset=0)` is byte-identical to the no-offset path, so it is
// treated as "no offset" — never threaded, never diagnosed.
function isLiteralZero(node: ExpressionNode): boolean {
    return (
        node.kind === "literal-expression" &&
        (node.literalKind === "int" || node.literalKind === "float") &&
        Number(node.value) === 0
    );
}

// Render a direct `ta.*(...)` plot value with a `{ offset: <expr> }` opts
// object threaded onto the call. The ta call's positional args render
// verbatim; any named args fold into the same trailing opts object, and the
// plot-level `offset` overrides a same-named `offset` on the ta call (emitting
// `plot-offset-overrides-ta-offset`). The Pine member chain is emitted verbatim
// (the established plot-path behaviour — no `taLookup`).
function renderTaWithOffset(
    value: CallExpression,
    offsetSource: string,
    ctx: EmitContext,
    diagnostics: DiagnosticCollector,
): string {
    const callee = emitWithContext(value.callee, ctx);
    const positionals = value.args
        .filter((arg) => arg.name === null)
        .map((arg) => emitWithContext(arg.value, ctx));
    const optsParts: string[] = [];
    for (const arg of value.args) {
        if (arg.name === null || arg.name === "offset") {
            continue;
        }
        optsParts.push(`${arg.name}: ${emitWithContext(arg.value, ctx)}`);
    }
    if (named(value.args, "offset") !== null) {
        diagnostics.pushCode("plot-offset-overrides-ta-offset", value.span);
    }
    optsParts.push(`offset: ${offsetSource}`);
    return `${callee}(${[...positionals, `{ ${optsParts.join(", ")} }`].join(", ")})`;
}

// Render the plotted value, threading a non-zero `offset=` onto a direct
// `ta.*` call's opts. A non-`ta.*` value cannot carry a chartlang offset (there
// is no plot-level offset), so the offset is dropped with
// `plot-offset-needs-ta-call`.
function emitPlotValue(
    value: ExpressionNode,
    args: readonly CallArgument[],
    ctx: EmitContext,
    diagnostics: DiagnosticCollector,
): string {
    const offsetNode = named(args, "offset");
    if (offsetNode === null || isLiteralZero(offsetNode)) {
        return emitWithContext(value, ctx);
    }
    if (value.kind === "call-expression" && (dottedCallee(value)?.startsWith("ta.") ?? false)) {
        return renderTaWithOffset(value, emitWithContext(offsetNode, ctx), ctx, diagnostics);
    }
    diagnostics.pushCode("plot-offset-needs-ta-call", value.span);
    return emitWithContext(value, ctx);
}

function emitPlot(
    args: readonly CallArgument[],
    pos: readonly ExpressionNode[],
    ctx: EmitContext,
    diagnostics: DiagnosticCollector,
): string | null {
    const value = pos[0];
    if (value === undefined) {
        return null;
    }
    const opts = commonOptions(args, pos, ctx);
    const valueSource = emitPlotValue(value, args, ctx, diagnostics);
    return opts === "" ? `plot(${valueSource});` : `plot(${valueSource}, ${opts});`;
}

// The chartlang enum string a named member-enum arg maps to (`location=
// location.abovebar` → `"above"`), or `null` when absent / unmapped.
function enumArg(args: readonly CallArgument[], key: string): string | null {
    const node = named(args, key);
    if (node === null || node.kind !== "member-access-expression" || node.head !== null) {
        return null;
    }
    const mapping = enumLookup(node.chain.join("."));
    return mapping !== null && typeof mapping.chartlang === "string" ? mapping.chartlang : null;
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
    // A `ta.*` boolean (e.g. `ta.crossover`) is a `Series<boolean>` in
    // chartlang, not a scalar — the same shape `emitTa` projects to a per-bar
    // value with `.current`. As a bare ternary condition the Series object is
    // always truthy, so the shape would plot on every bar; project the
    // current-bar scalar boolean so the gate fires only on the event.
    const cond =
        condition.kind === "call-expression" &&
        (dottedCallee(condition)?.startsWith("ta.") ?? false)
            ? `${emitWithContext(condition, ctx)}.current`
            : emitWithContext(condition, ctx);
    const location = enumArg(args, "location");
    const locPart = location === null ? "" : `, location: "${location}"`;
    let style: string;
    if (name === "plotshape") {
        // chartlang's `shape` style requires a `PlotShapeGlyph` + `size`; the
        // Pine `style=shape.*` glyph maps through `enumLookup` (default circle).
        const glyph = enumArg(args, "style") ?? "circle";
        style = `{ kind: "shape", shape: "${glyph}", size: 8${locPart} }`;
    } else if (name === "plotchar") {
        const charNode = named(args, "char");
        const char = charNode === null ? '"•"' : emitWithContext(charNode, ctx);
        style = `{ kind: "character", char: ${char}, size: 12${locPart} }`;
    } else {
        // Pine `plotarrow` direction follows the series sign at runtime, which
        // is not statically known; default to "up".
        style = `{ kind: "arrow", direction: "up", size: 10 }`;
    }
    // The glyph styles carry no `color`; preserve a `color=` arg at plot level.
    const colorNode = named(args, "color");
    const colorPart = colorNode === null ? "" : `color: ${styleValue(colorNode, ctx)}, `;
    return `plot(${cond} ? bar.close : Number.NaN, { ${colorPart}style: ${style} });`;
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

// Lower Pine `bgcolor(color, transp?, …, title?)` / `barcolor(color, …,
// title?)` to the chartlang Pine-ergonomic sugar `bgcolor(<color>, opts?)` /
// `barcolor(<color>, opts?)`. The color expression — including a per-bar
// conditional (`close > open ? color.green : color.red`) — rides through
// `styleValue`, so the per-bar dynamic-color semantics (Deliverable 2's
// `colorValue` channel) survive the conversion. `transp` (bgcolor only) and
// `title` (both) map onto the `BgColorOpts` / `BarColorOpts` bag. A bare call
// with no color is a no-op → `null` (unchanged).
function emitBackground(
    callee: "bgcolor" | "barcolor",
    args: readonly CallArgument[],
    pos: readonly ExpressionNode[],
    ctx: EmitContext,
): string | null {
    const color = pos[0];
    if (color === undefined) {
        return null;
    }
    const transpNode = callee === "bgcolor" ? (named(args, "transp") ?? pos[1] ?? null) : null;
    const titleNode = named(args, "title") ?? null;
    const opts = options([
        ["transp", transpNode === null ? null : emitWithContext(transpNode, ctx)],
        ["title", titleNode === null ? null : emitWithContext(titleNode, ctx)],
    ]);
    const colorSource = styleValue(color, ctx);
    return opts === "" ? `${callee}(${colorSource});` : `${callee}(${colorSource}, ${opts});`;
}
