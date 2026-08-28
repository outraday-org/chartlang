// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CallArgument, CallExpression, ExpressionNode, Statement } from "../ast/index.js";
import { displayLookup, enumLookup } from "../mapping/index.js";
import { dottedCallee } from "./callArgs.js";
import { convertColorWith, isTranspColorForm } from "./colorConvert.js";
import type { DiagnosticCollector } from "./diagnosticCollector.js";
import type { EmitContext } from "./emitContext.js";
import { emitScalar, emitWithContext } from "./emitContext.js";
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
        // A ternary test is the same SCALAR position `emitIf` documents.
        const cond = emitScalar(node.condition, ctx);
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
// resolver; `lineWidth` takes the named arg or the caller-supplied positional
// slot (`plot`: 3, `hline`: 4). Returned
// as a pair list so `emitPlot` can append its plot-only `visible` pair before
// rendering, while `hline` renders the pairs as-is.
function commonOptionPairs(
    args: readonly CallArgument[],
    pos: readonly ExpressionNode[],
    ctx: EmitContext,
    diagnostics: DiagnosticCollector,
    widthPosition = 3,
): ReadonlyArray<readonly [string, string | null]> {
    const titleNode = named(args, "title") ?? pos[1] ?? null;
    const colorNode = named(args, "color") ?? pos[2] ?? null;
    const widthNode = named(args, "linewidth") ?? pos[widthPosition] ?? null;
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
            return emitCandle(call.args, pos, ctx, diagnostics);
        case "plotbar":
            return emitBar(call.args, pos, ctx, diagnostics);
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

type DisplayMemberVerdict = Readonly<{
    kind: "all" | "none";
    approximated: boolean;
}>;

// Resolve one `display.*` member to its chart-pane visibility truth. The
// mapping row's `notes` bit is the single source for whether placement details
// were discarded and therefore need `plot-display-approximated`.
function displayMemberVerdict(node: ExpressionNode): DisplayMemberVerdict | null {
    if (node.kind !== "member-access-expression" || node.head !== null) {
        return null;
    }
    const mapping = displayLookup(node.chain.join("."));
    if (mapping === null || (mapping.chartlang !== "all" && mapping.chartlang !== "none")) {
        return null;
    }
    return { kind: mapping.chartlang, approximated: mapping.notes !== undefined };
}

// Pine's `display` values are bitmasks and may be combined with `+` or have
// placements removed with `-`. Chartlang only needs the pane bit, so fold that
// bit recursively while retaining whether any placement detail was discarded.
function displayVerdict(node: ExpressionNode): DisplayMemberVerdict | null {
    if (node.kind === "paren-expression") {
        return displayVerdict(node.expression);
    }
    const member = displayMemberVerdict(node);
    if (member !== null) {
        return member;
    }
    if (node.kind !== "binary-expression" || (node.operator !== "+" && node.operator !== "-")) {
        return null;
    }
    const left = displayVerdict(node.left);
    const right = displayVerdict(node.right);
    if (left === null || right === null) {
        return null;
    }
    const leftHasPane = left.kind === "all";
    const rightHasPane = right.kind === "all";
    const hasPane =
        node.operator === "+" ? leftHasPane || rightHasPane : leftHasPane && !rightHasPane;
    return {
        kind: hasPane ? "all" : "none",
        approximated: left.approximated || right.approximated,
    };
}

// Lower a Pine plot-family `display` argument onto chartlang's `{ visible }`
// channel. The named arg wins; otherwise `displayPosition` addresses the
// function's documented positional signature. Placement-only targets preserve
// their pane truth while raising `plot-display-approximated`:
//   - `<cond> ? display.all : display.none` → `<emit(cond)>`
//   - `<cond> ? display.none : display.all` → `!(<emit(cond)>)`
//   - `<cond> ? display.pane : display.none` → `<emit(cond)>` + diagnostic
//   - `display.status_line` / `price_scale` / `data_window` → `false` + diagnostic
//   - `display.none` → `"false"`; `display.all` → omit (`null`)
//   - anything unknown → `plot-display-approximated` + omit (`null`)
function displayOption(
    args: readonly CallArgument[],
    pos: readonly ExpressionNode[],
    displayPosition: number,
    ctx: EmitContext,
    diagnostics: DiagnosticCollector,
): string | null {
    const node = named(args, "display") ?? pos[displayPosition] ?? null;
    if (node === null) {
        return null;
    }
    if (node.kind === "ternary-expression") {
        const yes = displayVerdict(node.consequent);
        const no = displayVerdict(node.alternate);
        if (yes === null || no === null) {
            diagnostics.pushCode("plot-display-approximated", node.span);
            return null;
        }
        if (yes.approximated || no.approximated) {
            diagnostics.pushCode("plot-display-approximated", node.span);
        }
        // `visible` is a scalar `boolean`, so the ternary's condition is the
        // same SCALAR position `emitIf` documents — a root `ta.*` boolean
        // lowers to its per-bar `.current` value.
        if (yes.kind === "all" && no.kind === "none") {
            return emitScalar(node.condition, ctx);
        }
        if (yes.kind === "none" && no.kind === "all") {
            return `!(${emitScalar(node.condition, ctx)})`;
        }
        return yes.kind === "none" ? "false" : null;
    }
    const verdict = displayVerdict(node);
    if (verdict === null) {
        diagnostics.pushCode("plot-display-approximated", node.span);
        return null;
    }
    if (verdict.approximated) {
        diagnostics.pushCode("plot-display-approximated", node.span);
    }
    if (verdict.kind === "none") {
        return "false";
    }
    return null;
}

// Lower the Pine `plot.style_*` value into one typed chartlang style object.
// Ternaries stay dynamic: Chartlang evaluates the options expression per bar,
// so the selected style reaches the runtime without choosing a branch during
// conversion. Anything outside the exact supported set rejects the whole plot
// via `plot-style-not-mapped`; silently omitting `style` would turn it into a
// plausible but wrong line.
function plotStyleOption(
    node: ExpressionNode,
    baseline: string,
    ctx: EmitContext,
    diagnostics: DiagnosticCollector,
): string | null {
    if (node.kind === "paren-expression") {
        const inner = plotStyleOption(node.expression, baseline, ctx, diagnostics);
        return inner === null ? null : `(${inner})`;
    }
    if (node.kind === "ternary-expression") {
        const yes = plotStyleOption(node.consequent, baseline, ctx, diagnostics);
        const no = plotStyleOption(node.alternate, baseline, ctx, diagnostics);
        if (yes === null || no === null) {
            return null;
        }
        return `${emitScalar(node.condition, ctx)} ? ${yes} : ${no}`;
    }
    if (node.kind === "member-access-expression" && node.head === null) {
        const mapping = enumLookup(node.chain.join("."));
        switch (mapping?.chartlang) {
            case "line":
                return `{ kind: "line" }`;
            case "step-line":
                return `{ kind: "step-line" }`;
            case "histogram":
                return `{ kind: "histogram", baseline: ${baseline} }`;
            case "columns":
                return `{ kind: "columns", baseline: ${baseline} }`;
            case "circles":
                // Pine's circle presentation maps to chartlang's existing
                // discrete marker glyph. The plot-level linewidth is retained
                // independently by `commonOptionPairs`; 8 CSS px is the
                // converter's compact circle-marker presentation.
                return `{ kind: "marker", shape: "circle", size: 8 }`;
        }
    }
    diagnostics.pushCode("plot-style-not-mapped", node.span);
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
    const styleNode = named(args, "style") ?? pos[4] ?? null;
    const baselineNode = named(args, "histbase") ?? pos[6] ?? null;
    const baseline = baselineNode === null ? "0" : emitWithContext(baselineNode, ctx);
    const style =
        styleNode === null ? null : plotStyleOption(styleNode, baseline, ctx, diagnostics);
    if (styleNode !== null && style === null) {
        return null;
    }
    const visiblePair: readonly [string, string | null] = [
        "visible",
        displayOption(args, pos, 11, ctx, diagnostics),
    ];
    const stylePair: readonly [string, string | null] = ["style", style];
    const opts = options([
        ...commonOptionPairs(args, pos, ctx, diagnostics),
        visiblePair,
        stylePair,
    ]);
    const valueSource = emitPlotValue(value, args, ctx, diagnostics);
    return opts === "" ? `plot(${valueSource});` : `plot(${valueSource}, ${opts});`;
}

// The chartlang enum string a named member-enum arg maps to (`location=
// location.abovebar` → `"above"`), or `null` when absent / unmapped.
function enumArg(args: readonly CallArgument[], key: string): string | null {
    return enumValue(named(args, key));
}

function enumValue(node: ExpressionNode | null | undefined): string | null {
    if (
        node === null ||
        node === undefined ||
        node.kind !== "member-access-expression" ||
        node.head !== null
    ) {
        return null;
    }
    const mapping = enumLookup(node.chain.join("."));
    return mapping !== null && typeof mapping.chartlang === "string" ? mapping.chartlang : null;
}

const PLOT_GLYPH_SIZE_PX: ReadonlyMap<string, number> = new Map([
    ["tiny", 8],
    ["small", 10],
    ["normal", 12],
    ["large", 16],
    ["huge", 24],
]);

// Resolve Pine's static `size.*` enum to the same CSS-pixel ladder used by the
// shared chartlang text/table presentation layer. Plot glyph size is static in
// Pine; an opaque expression cannot be converted to chartlang's numeric size.
function plotGlyphSize(
    node: ExpressionNode | null,
    defaultSize: number,
    diagnostics: DiagnosticCollector,
): string | null {
    if (node === null) {
        // Keep each plot family's established default when Pine omits `size`.
        // Task 4 needs exact explicit `size.tiny` preservation for MASM; it
        // must not also resize existing style-less plotshape/plotchar output.
        return String(defaultSize);
    }
    const mapped = enumValue(node);
    const size = mapped === null ? undefined : PLOT_GLYPH_SIZE_PX.get(mapped);
    if (size === undefined) {
        diagnostics.pushCode("plot-style-not-mapped", node.span);
        return null;
    }
    return String(size);
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
    // chartlang, not a scalar. As a bare ternary condition the Series object is
    // always truthy, so the shape would plot on every bar. `emitScalar` — the
    // ONE rule every truthiness position uses (see `emitIf`) — projects the
    // current-bar boolean so the gate fires only on the event. It replaced a
    // name-shaped `.current` append here, which missed a PARENTHESISED
    // predicate (a `paren-expression` fails a `kind === "call-expression"`
    // test) and never resolved a signature-divergent / pivot `ta.*` name.
    const cond = emitScalar(condition, ctx);
    const displayPosition = name === "plotarrow" ? 9 : 11;
    const visible = displayOption(args, pos, displayPosition, ctx, diagnostics);
    const titleNode = named(args, "title") ?? pos[1] ?? null;
    const titlePart = titleNode === null ? "" : `title: ${emitWithContext(titleNode, ctx)}, `;
    const location = enumValue(named(args, "location") ?? pos[3]);
    const locPart = location === null ? "" : `, location: "${location}"`;
    let style: string;
    if (name === "plotshape") {
        // chartlang's `shape` style requires a `PlotShapeGlyph` + `size`; the
        // Pine `style=shape.*` glyph maps through `enumLookup`; an omitted
        // style uses Pine's documented `shape.xcross` default.
        // Pine's optional overlaid text + independent text color stay on the
        // typed shape descriptor so a renderer can reproduce `1`/`2`/`sl1`.
        const glyphNode = named(args, "style") ?? pos[2] ?? null;
        const glyph = glyphNode === null ? "xcross" : enumValue(glyphNode);
        if (glyph === null) {
            diagnostics.pushCode("plot-style-not-mapped", glyphNode.span);
            return null;
        }
        const size = plotGlyphSize(named(args, "size") ?? pos[9] ?? null, 8, diagnostics);
        if (size === null) {
            return null;
        }
        const textNode = named(args, "text") ?? pos[6] ?? null;
        const textPart = textNode === null ? "" : `, text: ${emitWithContext(textNode, ctx)}`;
        const textColorNode = named(args, "textcolor") ?? pos[7] ?? null;
        const textColorPart =
            textColorNode === null
                ? ""
                : `, textColor: ${styleValue(textColorNode, ctx, diagnostics)}`;
        style = `{ kind: "shape", shape: "${glyph}", size: ${size}${locPart}${textPart}${textColorPart} }`;
    } else if (name === "plotchar") {
        const charNode = named(args, "char") ?? pos[2] ?? null;
        const char = charNode === null ? '"•"' : emitWithContext(charNode, ctx);
        const size = plotGlyphSize(named(args, "size") ?? pos[9] ?? null, 12, diagnostics);
        if (size === null) {
            return null;
        }
        style = `{ kind: "character", char: ${char}, size: ${size}${locPart} }`;
    } else {
        // Pine `plotarrow` direction follows the series sign at runtime, which
        // is not statically known; default to "up".
        style = `{ kind: "arrow", direction: "up", size: 10 }`;
    }
    // The glyph styles carry no `color`; preserve a `color=` arg at plot level.
    const colorNode = named(args, "color") ?? (name === "plotarrow" ? null : (pos[4] ?? null));
    const colorPart =
        colorNode === null ? "" : `color: ${styleValue(colorNode, ctx, diagnostics)}, `;
    const visiblePart = visible === null ? "" : `visible: ${visible}, `;
    return `plot(${cond} ? bar.close : Number.NaN, { ${titlePart}${colorPart}${visiblePart}style: ${style} });`;
}

function emitCandle(
    args: readonly CallArgument[],
    pos: readonly ExpressionNode[],
    ctx: EmitContext,
    diagnostics: DiagnosticCollector,
): string | null {
    const open = pos[0];
    const high = pos[1];
    const low = pos[2];
    const close = pos[3];
    if (open === undefined || high === undefined || low === undefined || close === undefined) {
        return null;
    }
    const visible = displayOption(args, pos, 10, ctx, diagnostics);
    const visiblePart = visible === null ? "" : `visible: ${visible}, `;
    return `plot(${emitWithContext(close, ctx)}, { ${visiblePart}style: { kind: "candle-override" } });`;
}

function emitBar(
    args: readonly CallArgument[],
    pos: readonly ExpressionNode[],
    ctx: EmitContext,
    diagnostics: DiagnosticCollector,
): string | null {
    const colorNode = named(args, "color");
    const colorPart =
        colorNode === null ? "" : `, color: ${styleValue(colorNode, ctx, diagnostics)}`;
    const visible = displayOption(args, pos, 8, ctx, diagnostics);
    const visiblePart = visible === null ? "" : `visible: ${visible}, `;
    return `plot(Number.NaN, { ${visiblePart}style: { kind: "bar-override"${colorPart} } });`;
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
    const styleStr = enumArg(args, "linestyle") ?? enumValue(pos[3]);
    const opts = options([
        ...commonOptionPairs(args, pos, ctx, diagnostics, 4),
        ["lineStyle", styleStr === null ? null : JSON.stringify(styleStr)],
        ["visible", displayOption(args, pos, 6, ctx, diagnostics)],
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
