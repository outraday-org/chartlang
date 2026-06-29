// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CallArgument, CallExpression, ExpressionNode, Statement } from "../ast/index.js";
import { displayLookup, enumLookup } from "../mapping/index.js";
import { dottedCallee } from "./callArgs.js";
import { convertColorWith, isTranspColorForm } from "./colorConvert.js";
import type { DiagnosticCollector } from "./diagnosticCollector.js";
import type { EmitContext } from "./emitContext.js";
import { emitWithContext } from "./emitContext.js";
import type { FillBetweenEdge } from "./polylineLinefill.js";
import { emitFillBetweenBand } from "./polylineLinefill.js";

// Lower a styling value: a bare-rooted `color.*`/enum member routes through
// `enumLookup` (so `color.red` → `"#FF5252"`); a per-bar conditional color
// (`close > open ? color.green : color.red`) recurses through the ternary
// branches (and paren grouping) so each color leaf resolves while the
// condition flows through the normal emitter — the dynamic-color expression
// `bgcolor`/`barcolor` carry through to the `colorValue` channel. The LEAF
// routes through the shared `convertColorWith` (input/state-aware emit) so a
// `color.new(base, transp)` / 4-arg `color.rgb(...)` folds to a `#RRGGBBAA`
// hex (literal base) or `color.withAlpha(...)` (dynamic base) — raising
// `color-transp-approximated` — and any other expression lowers through the
// input-aware emitter unchanged.
function styleValue(
    node: ExpressionNode,
    ctx: EmitContext,
    diagnostics: DiagnosticCollector,
): string {
    if (node.kind === "member-access-expression" && node.head === null) {
        const mapping = enumLookup(node.chain.join("."));
        if (mapping !== null && typeof mapping.chartlang === "string") {
            return JSON.stringify(mapping.chartlang);
        }
    }
    if (node.kind === "paren-expression") {
        return `(${styleValue(node.expression, ctx, diagnostics)})`;
    }
    if (node.kind === "ternary-expression") {
        const cond = emitWithContext(node.condition, ctx);
        const yes = styleValue(node.consequent, ctx, diagnostics);
        const no = styleValue(node.alternate, ctx, diagnostics);
        return `${cond} ? ${yes} : ${no}`;
    }
    if (isTranspColorForm(node)) {
        diagnostics.pushCode("color-transp-approximated", node.span);
    }
    return convertColorWith(node, (sub) => emitWithContext(sub, ctx));
}

// The plot-family bare callee names this transform recognises.
type PlotFamilyName =
    | "plot"
    | "plotshape"
    | "plotchar"
    | "plotcandle"
    | "plotbar"
    | "plotarrow"
    | "hline"
    | "bgcolor"
    | "barcolor"
    | "fill";

const PLOT_FAMILY: ReadonlySet<string> = new Set<PlotFamilyName>([
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

// The plot-family member a call dispatches on, or `null` when its bare callee
// is not one. Membership-checked, then narrowed to the literal union so the
// `emitPlotFamily` switch is exhaustive (no dead `default` reject arm).
function plotFamilyName(call: CallExpression): PlotFamilyName | null {
    const name = bareCallee(call);
    return name !== null && PLOT_FAMILY.has(name) ? (name as PlotFamilyName) : null;
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
    return plotFamilyName(call) !== null;
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

// The title / color / lineWidth option pairs shared by `plot` and `hline`.
// `title` falls back to the second positional; `color` routes through the enum
// resolver; `lineWidth` takes the named arg or the fourth positional. Returned
// as a pair list so `emitPlot` can append its plot-only `visible` pair before
// rendering, while `hline` renders the pairs as-is.
function commonOptionPairs(
    args: readonly CallArgument[],
    pos: readonly ExpressionNode[],
    ctx: EmitContext,
    diagnostics: DiagnosticCollector,
): ReadonlyArray<readonly [string, string | null]> {
    const titleNode = named(args, "title") ?? pos[1] ?? null;
    const colorNode = named(args, "color") ?? pos[2] ?? null;
    const widthNode = named(args, "linewidth") ?? pos[3] ?? null;
    return [
        ["title", titleNode === null ? null : emitWithContext(titleNode, ctx)],
        ["color", colorNode === null ? null : styleValue(colorNode, ctx, diagnostics)],
        ["lineWidth", widthNode === null ? null : emitWithContext(widthNode, ctx)],
    ];
}

/**
 * Lower a Pine plot-family call into a chartlang `plot(...)` / `hline(...)`
 * statement string, or push a reject diagnostic. `plot` maps title/color/
 * linewidth onto a `{ ... }` options object; `plotshape`/`plotchar`/
 * `plotarrow` gate the value behind their condition (`cond ? value : NaN`)
 * and select a `style.kind`; `bgcolor`/`barcolor` emit the Pine-ergonomic
 * `bgcolor(<color>)` / `barcolor(<color>)` sugar carrying the real per-bar
 * color expression (Deliverable-2 dynamic-color channel); `hline` maps to
 * chartlang `hline(price, { ... })`. `fill(a, b, color?)` over two `hline`/
 * `plot` handles lowers to a `draw.fillBetween` band (resolving the handles
 * against `body`); an unresolved handle pushes `fill-handle-unresolved` and a
 * gradient / `fillgaps` form pushes `fill-not-mapped`. Returns `null` for a
 * non-plot-family call (and for any reject).
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
 *     emitPlotFamily(call, ctx, new DiagnosticCollector(), []); // "plot(bar.close);"
 */
export function emitPlotFamily(
    call: CallExpression,
    ctx: EmitContext,
    diagnostics: DiagnosticCollector,
    body: readonly Statement[],
): string | null {
    const name = plotFamilyName(call);
    if (name === null) {
        return null;
    }
    const pos = positional(call.args);
    switch (name) {
        case "plot":
            return emitPlot(call.args, pos, ctx, diagnostics);
        case "plotshape":
        case "plotchar":
        case "plotarrow":
            return emitConditional(name, call.args, pos, ctx, diagnostics);
        case "plotcandle":
            return emitCandle(pos, ctx);
        case "plotbar":
            return emitBar(call.args, ctx, diagnostics);
        case "hline":
            return emitHline(call.args, pos, ctx, diagnostics);
        case "bgcolor":
            return emitBackground("bgcolor", call.args, pos, ctx, diagnostics);
        case "barcolor":
            return emitBackground("barcolor", call.args, pos, ctx, diagnostics);
        case "fill":
            return emitFill(call, pos, ctx, diagnostics, body);
    }
}

// The Pine gradient / `fillgaps` `fill` styling args with no v1 chartlang
// analogue; their presence keeps the (narrowed) `fill-not-mapped` reject.
const UNSUPPORTED_FILL_ARGS: readonly string[] = [
    "fillgaps",
    "top_color",
    "bottom_color",
    "top_value",
    "bottom_value",
];

// Lower a Pine `fill(a, b, color?)` over two `hline`/`plot` handles to a
// `draw.fillBetween` band. A gradient / `fillgaps` form is the narrowed
// `fill-not-mapped` reject; a handle that resolves to neither an `hline`/`plot`
// (top-level or inline) is `fill-handle-unresolved`. `fill` is never silently
// dropped — every unsupported shape emits exactly one diagnostic.
function emitFill(
    call: CallExpression,
    pos: readonly ExpressionNode[],
    ctx: EmitContext,
    diagnostics: DiagnosticCollector,
    body: readonly Statement[],
): string | null {
    if (UNSUPPORTED_FILL_ARGS.some((key) => named(call.args, key) !== null)) {
        diagnostics.pushCode("fill-not-mapped", call.span);
        return null;
    }
    const argA = pos[0];
    const argB = pos[1];
    const edgeA = argA === undefined ? null : resolveFillEdge(argA, body, ctx);
    const edgeB = argB === undefined ? null : resolveFillEdge(argB, body, ctx);
    if (edgeA === null || edgeB === null) {
        diagnostics.pushCode("fill-handle-unresolved", call.span);
        return null;
    }
    // The fill color rides the shared plot-family `styleValue` rule (enum /
    // ternary / T6 transp fold, raising `color-transp-approximated` itself); no
    // `color` arg ⇒ `draw.fillBetween`'s default fill (opts omitted).
    const colorNode = named(call.args, "color") ?? pos[2] ?? null;
    const fill = colorNode === null ? null : styleValue(colorNode, ctx, diagnostics);
    return `${emitFillBetweenBand(edgeA, edgeB, fill).call};`;
}

// Resolve one `fill` handle argument to its band edge descriptor: an `hline(p)`
// → a constant-price edge; a `plot(e)` → a per-bar series edge. `null` when the
// arg resolves to neither (the `fill-handle-unresolved` reject).
function resolveFillEdge(
    arg: ExpressionNode,
    body: readonly Statement[],
    ctx: EmitContext,
): FillBetweenEdge | null {
    const defining = fillHandleCall(arg, body);
    if (defining === null) {
        return null;
    }
    const callee = bareCallee(defining);
    const first = positional(defining.args)[0];
    if (first === undefined) {
        return null;
    }
    if (callee === "hline") {
        return { kind: "constant", price: emitWithContext(first, ctx) };
    }
    if (callee === "plot") {
        return { kind: "series", value: emitWithContext(first, ctx) };
    }
    return null;
}

// The `hline`/`plot` call a `fill` handle arg names: the arg itself when it is
// an inline call, or the call bound to the arg identifier by a top-level
// `<name> = hline(...)` / `plot(...)` declaration or assignment. `null` for any
// other arg shape (a literal, an `array.get(...)` ring handle, an unbound name).
function fillHandleCall(arg: ExpressionNode, body: readonly Statement[]): CallExpression | null {
    if (arg.kind === "call-expression") {
        return arg;
    }
    if (arg.kind !== "identifier-expression") {
        return null;
    }
    for (const stmt of body) {
        if (
            stmt.kind === "variable-declaration" &&
            stmt.name === arg.name &&
            stmt.initializer.kind === "call-expression"
        ) {
            return stmt.initializer;
        }
        if (
            stmt.kind === "assignment" &&
            stmt.name === arg.name &&
            stmt.value.kind === "call-expression"
        ) {
            return stmt.value;
        }
    }
    return null;
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

// The visibility verdict a `display.*` member maps to: `"all"` (shown) /
// `"none"` (hidden) for the two toggle-mappable members, or `null` for an
// unsupported `display.*` target (or any non-member node). Routes through the
// `DISPLAY_MAP` table (the repo's mapping-not-inline invariant); `displayLookup`
// returns only the `all`/`none` entries, so the `=== "all"` test fully
// partitions its result.
function displayMemberKind(node: ExpressionNode): "all" | "none" | null {
    if (node.kind !== "member-access-expression" || node.head !== null) {
        return null;
    }
    const mapping = displayLookup(node.chain.join("."));
    if (mapping === null) {
        return null;
    }
    return mapping.chartlang === "all" ? "all" : "none";
}

// Lower a Pine `plot(..., display=<value>)` named arg onto the chartlang
// `{ visible }` channel. Returns the rendered `visible` value source, or `null`
// when no `visible` key should be emitted (the field is omitted for an absent
// `display=`, a constant `display.all`, and any approximated target — the last
// of which also raises `plot-display-approximated`). The runtime treats omitted
// and `visible: true` identically, so a fully-shown plot stays byte-clean.
//   - `<cond> ? display.all : display.none` → `<emit(cond)>`
//   - `<cond> ? display.none : display.all` → `!(<emit(cond)>)`
//   - `display.none` → `"false"`; `display.all` → omit (`null`)
//   - anything else → `plot-display-approximated` + omit (`null`)
function displayOption(
    args: readonly CallArgument[],
    ctx: EmitContext,
    diagnostics: DiagnosticCollector,
): string | null {
    const node = named(args, "display");
    if (node === null) {
        return null;
    }
    if (node.kind === "ternary-expression") {
        const yes = displayMemberKind(node.consequent);
        const no = displayMemberKind(node.alternate);
        if (yes === "all" && no === "none") {
            return emitWithContext(node.condition, ctx);
        }
        if (yes === "none" && no === "all") {
            return `!(${emitWithContext(node.condition, ctx)})`;
        }
        diagnostics.pushCode("plot-display-approximated", node.span);
        return null;
    }
    const kind = displayMemberKind(node);
    if (kind === "none") {
        return "false";
    }
    if (kind === "all") {
        return null;
    }
    diagnostics.pushCode("plot-display-approximated", node.span);
    return null;
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
    const visiblePair: readonly [string, string | null] = [
        "visible",
        displayOption(args, ctx, diagnostics),
    ];
    const opts = options([...commonOptionPairs(args, pos, ctx, diagnostics), visiblePair]);
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
    diagnostics: DiagnosticCollector,
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
    const colorPart =
        colorNode === null ? "" : `color: ${styleValue(colorNode, ctx, diagnostics)}, `;
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

function emitBar(
    args: readonly CallArgument[],
    ctx: EmitContext,
    diagnostics: DiagnosticCollector,
): string | null {
    const colorNode = named(args, "color");
    const colorPart =
        colorNode === null ? "" : `, color: ${styleValue(colorNode, ctx, diagnostics)}`;
    return `plot(Number.NaN, { style: { kind: "bar-override"${colorPart} } });`;
}

// Render an `hline(price, { ... })` chartlang call STRING (no trailing
// semicolon) shared by the statement form (`emitHline`) and the value form
// (`emitHlineValue`, for an assigned `guide = hline(...)`). The Pine
// `linestyle = hline.style_*` named arg maps through `enumArg` onto the
// chartlang `lineStyle` option (`"solid"|"dashed"|"dotted"`); without this the
// style was silently dropped and the assigned form leaked `hline.style_dashed`
// verbatim.
function hlineCallString(
    args: readonly CallArgument[],
    pos: readonly ExpressionNode[],
    ctx: EmitContext,
    diagnostics: DiagnosticCollector,
): string | null {
    const price = pos[0];
    if (price === undefined) {
        return null;
    }
    const styleStr = enumArg(args, "linestyle");
    const opts = options([
        ...commonOptionPairs(args, pos, ctx, diagnostics),
        ["lineStyle", styleStr === null ? null : JSON.stringify(styleStr)],
    ]);
    const priceSource = emitWithContext(price, ctx);
    return opts === "" ? `hline(${priceSource})` : `hline(${priceSource}, ${opts})`;
}

function emitHline(
    args: readonly CallArgument[],
    pos: readonly ExpressionNode[],
    ctx: EmitContext,
    diagnostics: DiagnosticCollector,
): string | null {
    const call = hlineCallString(args, pos, ctx, diagnostics);
    return call === null ? null : `${call};`;
}

/**
 * Lower an `hline(...)` call used as a VALUE (an assigned `guide = hline(...)`)
 * to the chartlang `hline(price, { ... })` call string, or `null` for a
 * non-`hline` call. The statement-position path (`emitPlotFamily`) handles a
 * bare `hline(...)` expression statement; an assigned hline goes through
 * `emitCallValue`, which would otherwise emit the Pine positional args verbatim
 * (wrong arity + a leaked `hline.style_*`). Same lowering, no trailing `;`.
 *
 * @since 0.4
 * @stable
 * @example
 *     import { emitHlineValue } from "./plotFamily.js";
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
 *             name: "hline",
 *             span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 6 },
 *         },
 *         args: [
 *             {
 *                 name: null,
 *                 value: {
 *                     kind: "literal-expression",
 *                     literalKind: "int",
 *                     value: "0",
 *                     span: { startLine: 1, startColumn: 7, endLine: 1, endColumn: 8 },
 *                 },
 *                 span: { startLine: 1, startColumn: 7, endLine: 1, endColumn: 8 },
 *             },
 *         ],
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 9 },
 *     } as const;
 *     emitHlineValue(call, ctx, new DiagnosticCollector()); // "hline(0)"
 */
export function emitHlineValue(
    call: CallExpression,
    ctx: EmitContext,
    diagnostics: DiagnosticCollector,
): string | null {
    if (bareCallee(call) !== "hline") {
        return null;
    }
    return hlineCallString(call.args, positional(call.args), ctx, diagnostics);
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
    diagnostics: DiagnosticCollector,
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
    const colorSource = styleValue(color, ctx, diagnostics);
    return opts === "" ? `${callee}(${colorSource});` : `${callee}(${colorSource}, ${opts});`;
}
