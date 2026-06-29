// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CallExpression, ExpressionNode } from "../ast/index.js";
import type { SourceSpan } from "../index.js";
import {
    ARRAY_REDUCTION_MAP,
    ARRAY_SORT_ORDER_MAP,
    MAP_BUILTIN_MAP,
    mathLookup,
    remapIdentifier,
    taLookup,
} from "../mapping/index.js";
import { spanKey } from "./callArgs.js";
import type { AnnotationLookup } from "./exprEmit.js";
import { emitExpr } from "./exprEmit.js";
import type { SecurityFeedInputs } from "./securityShape.js";
import { emitStr } from "./strFormat.js";

/**
 * The diagnostic codes the numeric-array reduction rewrite may raise through
 * {@link EmitContext.arrayWarn}: an unsupported reduction (nearest-rank /
 * unmapped `array.*`) and the in-place-vs-copy `sort` caveat.
 *
 * @since 1.4
 * @stable
 * @example
 *     const code: ArrayReductionWarnCode = "array-sort-returns-copy";
 *     void code;
 */
export type ArrayReductionWarnCode = "array-reduction-not-mapped" | "array-sort-returns-copy";

/**
 * The diagnostic code the `map.*` rewrite may raise through
 * {@link EmitContext.mapWarn}: an unsupported `map.*` member over a `state.map`
 * slot (the no-iterator `map.keys`/`map.values`, or any unmapped `map.*`).
 *
 * @since 1.4
 * @stable
 * @example
 *     const code: MapBuiltinWarnCode = "map-builtin-not-mapped";
 *     void code;
 */
export type MapBuiltinWarnCode = "map-builtin-not-mapped";

/**
 * The diagnostic codes the nested `ta.*` scalar-position lowering may raise
 * through {@link EmitContext.taWarn}: an info when a nested `ta.*` is projected
 * to its `.current` scalar, and a warning when an unmapped / rejected `ta.*` is
 * left as a `Series` in a scalar position.
 *
 * @since 1.5
 * @stable
 * @example
 *     const code: NestedTaWarnCode = "nested-ta-lowered";
 *     void code;
 */
export type NestedTaWarnCode = "nested-ta-lowered" | "nested-ta-not-lowered";

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
     * Pine names of the `var`/`varip` scalars lowered to a series slot — a
     * history-indexed `state.series` (numeric), `state.boolSeries` (bool), or
     * `state.stringSeries` (string). A `[n]` history read of one of these emits
     * the BARE slot local (`<slot>[n]`, a real `Series<T>` read), not the scalar
     * `<slot>.value[n]` (a typecheck error). A plain VALUE read still flows
     * through `stateSlots` → `<slot>.value` (every series slot exposes a writable
     * `.value` head; the numeric one is additionally number-coercible, the
     * bool/string ones are not). Absent → no series slots.
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
     * `<slot>.clear()`). The reduction family (`array.avg`/`array.stdev`/
     * `array.median`/…) lowers the same way onto the handle methods. The
     * capacity sizes a `for i = 0 to array.size(coll)` walk's LITERAL loop bound
     * (chartlang forbids a non-literal bound; the slot's `get` gates the filled
     * count internally). Absent → no array slots.
     */
    arraySlots?: ReadonlyMap<string, ArraySlotInfo>;
    /**
     * Diagnostic sink for the numeric-array reduction rewrite — a structural
     * `(code, span) => void` (the `DrawCallContext.warn` precedent) populated by
     * `transformOther` from the `DiagnosticCollector`, where it is in scope. It
     * fires only inside the slot-gated reduction lowering: an unsupported
     * reduction (nearest-rank / unmapped `array.*`) raises
     * `array-reduction-not-mapped`, and an `array.sort` raises the
     * `array-sort-returns-copy` copy caveat. Absent (every other `EmitContext`
     * construction, where `arraySlots` is also absent) → no diagnostics.
     */
    arrayWarn?: (code: ArrayReductionWarnCode, span: SourceSpan) => void;
    /**
     * Pine map name → its chartlang `state.map` slot (local name + synthesized
     * literal capacity), for a numeric-value `var map<K, V>` lowered to
     * `state.map<number, number>(cap)`. A `map.*(id, …)` call over one of these
     * rewrites onto the slot's surface (`map.put(id, k, v)` →
     * `<slot>.set(k, v)`, `map.get(id, k)` → `(<slot>.get(k) ?? Number.NaN)`,
     * `map.contains(id, k)` → `<slot>.has(k)`, `map.remove(id, k)` →
     * `<slot>.delete(k)`, `map.size(id)` → `<slot>.size`, `map.clear(id)` →
     * `<slot>.clear()`). Absent → no map slots.
     */
    mapSlots?: ReadonlyMap<string, MapSlotInfo>;
    /**
     * Diagnostic sink for the `map.*` rewrite — a structural `(code, span) =>
     * void` (the `arrayWarn` precedent) populated by `transformOther` from the
     * `DiagnosticCollector`. It fires only inside the slot-gated rewrite, for an
     * unsupported member (`map.keys`/`map.values` or an unmapped `map.*`), which
     * emits a `Number.NaN` placeholder + `map-builtin-not-mapped`. Absent → no
     * diagnostics.
     */
    mapWarn?: (code: MapBuiltinWarnCode, span: SourceSpan) => void;
    /**
     * Diagnostic sink for the nested `ta.*` scalar-position lowering — a
     * structural `(code, span) => void` (the `arrayWarn`/`mapWarn` precedent)
     * populated by `transformOther` from the `DiagnosticCollector`. It fires
     * only inside `rewriteTree`'s scalar-position `ta.*` handling: a lowered
     * nested `ta.*` raises `nested-ta-lowered` (info, deduped once per script by
     * the sink), and an unmapped / rejected `ta.*` left as a `Series` raises
     * `nested-ta-not-lowered` (warning). Absent (every other `EmitContext`
     * construction) → no diagnostics.
     */
    taWarn?: (code: NestedTaWarnCode, span: SourceSpan) => void;
    /**
     * Pine input names that can source a `request.security` feed, mapped to
     * their axis (`input.symbol` → `"symbol"`, `input.timeframe` →
     * `"interval"`). Threaded into the shared feed resolver so an
     * identifier-bound symbol/timeframe lowers to its `inputs.<name>` reference.
     * Absent → no input-bound feeds (every literal/`tickerid` feed still
     * resolves).
     */
    securityFeedInputs?: SecurityFeedInputs;
    /**
     * Whether the statements being rendered are inside an emitted `for` loop.
     * Set on the child context of a runtime `for` body so a `break`/`continue`
     * lowers to a JS `break;`/`continue;`; absent/`false` at top level (and in
     * non-loop blocks) so a stray `break`/`continue` raises
     * `break-continue-outside-loop` instead of emitting an illegal jump.
     */
    inLoop?: boolean;
    /**
     * Inline `input.*(...)` call nodes promoted to a named top-level input,
     * mapped to that input's chartlang name. A promoted call is rewritten at its
     * USE SITE to the `inputs.<name>` read (`ta.wma(x * input.float(1.1), 5)` →
     * `ta.wma(x * (inputs.inlineInput as number), 5)`); without this the original
     * `input.float(...)` call would be emitted verbatim, which is invalid inside
     * `compute` (the `input.*` hole throws at runtime, and the positional
     * title/step args mis-shape the call). Keyed by the call's `spanKey` (NOT
     * node identity — `udfInline` clones nodes, so identity breaks; the span is
     * preserved), built by `transformInputs`. Absent → no inline-input
     * promotions.
     */
    promotedInline?: ReadonlyMap<string, string>;
    /**
     * Set while lowering a `request.security(opts, (bar) => …)` EXPRESSION
     * source body. Inside that callback `bar` is the `SecurityBar`, whose OHLCV
     * fields are `Series<Price>` (series-only, NOT the number-coercible
     * `PriceSeries` the MAIN `bar` exposes), so a bare `bar.close` cannot be used
     * in scalar arithmetic (`atr / close` ⇒ TS2363). When set, an OHLCV read is
     * projected to its `.current` scalar (`bar.close` → `bar.close.current`),
     * mirroring how `ta.*` results are always `.current`-projected. Absent (the
     * main compute body, where `bar` is the number-coercible `BarSeries`) → no
     * projection.
     */
    securityExpr?: boolean;
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

/**
 * A numeric-value `state.map` slot: its chartlang local name and its
 * synthesized compile-time literal capacity.
 *
 * @since 1.4
 * @stable
 * @example
 *     const info: MapSlotInfo = { local: "levels", cap: 1000 };
 *     void info;
 */
export type MapSlotInfo = Readonly<{ local: string; cap: number }>;

// The bare-rooted dotted callee of a call (`array.push`), or `null` for a
// computed callee. Local to the rewrite so `emitContext` stays self-contained.
function dottedCallee(callee: ExpressionNode): string | null {
    if (callee.kind === "member-access-expression" && callee.head === null) {
        return callee.chain.join(".");
    }
    return null;
}

/**
 * The `.current`-projected chartlang source for a mapped Pine `ta.*` call,
 * plus its signature-divergence note (if any). The single source of truth for
 * lowering a `ta.*` call to its current-bar scalar — consumed by the top-level
 * `emitTa` (which raises the diagnostics) and by the nested scalar-position
 * rule in {@link rewriteTree}.
 *
 * @since 1.5
 * @stable
 * @example
 *     const lowering: TaLowering = { source: "ta.rsi(bar.close, 14).current", signatureNote: undefined };
 *     void lowering;
 */
export type TaLowering = Readonly<{ source: string; signatureNote: string | undefined }>;

// `ta.pivothigh`/`ta.pivotlow` project a field of `ta.pivotsHighLow`'s result,
// which is a FUNCTION taking `{ leftLength, rightLength }` opts — not a
// `ta.pivotsHighLow.high(...)` method. Restructure the positional
// `(left, right)` (or trailing two of `(source, left, right)`) into the opts
// call and project the field. (Length args stay series-emitted, byte-identical
// to the established top-level behaviour.)
function emitPivot(name: string, call: CallExpression, ctx: EmitContext): string {
    const field = name === "ta.pivothigh" ? "high" : "low";
    const positional = call.args.filter((arg) => arg.name === null).map((arg) => arg.value);
    const right = positional[positional.length - 1];
    const left = positional.length >= 2 ? positional[positional.length - 2] : right;
    if (right === undefined || left === undefined) {
        return `ta.pivotsHighLow().${field}`;
    }
    const leftSrc = emitWithContext(left, ctx);
    const rightSrc = emitWithContext(right, ctx);
    return `ta.pivotsHighLow({ leftLength: ${leftSrc}, rightLength: ${rightSrc} }).${field}`;
}

/**
 * Lower a Pine `ta.*` {@link CallExpression} to its `(<chartlang call>).current`
 * scalar projection, or `null` when the call is not a `ta.*` member call or its
 * name is unmapped / a REJECT (`taLookup` → `null`). Signature-divergent names
 * (`ta.rma` → `ta.smma`) are resolved through `taLookup`; `ta.pivothigh`/
 * `ta.pivotlow` route through the `ta.pivotsHighLow` opts form. The call's
 * arguments are emitted in **series** position (chartlang `ta.*` sources are
 * `Series<number>`), so a `ta.*` fed as a source arg to another `ta.*` stays a
 * `Series`. Pure with respect to diagnostics — the caller raises any
 * `ta-not-mapped` / `ta-signature-divergence` note.
 *
 * @since 1.5
 * @stable
 * @example
 *     import { lowerTaToCurrent } from "./emitContext.js";
 *     const ctx = {
 *         annotations: new Map(),
 *         inputNames: new Set<string>(),
 *         localNames: new Set<string>(),
 *         stateSlots: new Map<string, string>(),
 *     };
 *     const span = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 } as const;
 *     const call = {
 *         kind: "call-expression",
 *         callee: { kind: "member-access-expression", head: null, chain: ["ta", "rsi"], span },
 *         args: [
 *             { name: null, value: { kind: "identifier-expression", name: "close", span }, span },
 *             { name: null, value: { kind: "literal-expression", literalKind: "int", value: "14", span }, span },
 *         ],
 *         span,
 *     } as const;
 *     lowerTaToCurrent(call, ctx)?.source; // "ta.rsi(bar.close, 14).current"
 */
export function lowerTaToCurrent(call: CallExpression, ctx: EmitContext): TaLowering | null {
    const name = dottedCallee(call.callee);
    if (name === null || !name.startsWith("ta.")) {
        return null;
    }
    const mapping = taLookup(name);
    if (mapping === null) {
        return null;
    }
    const body =
        name === "ta.pivothigh" || name === "ta.pivotlow"
            ? emitPivot(name, call, ctx)
            : `${mapping.chartlang}(${call.args
                  .map((arg) => emitWithContext(arg.value, ctx))
                  .join(", ")})`;
    return { source: `${body}.current`, signatureNote: mapping.signatureNote };
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
// are lowered recursively so a nested rewrite still applies. The write/read ops
// (`push`/`get`/`size`/`last`/`first`/`clear`) and the reduction family
// (`avg`/`stdev`/`median`/… via `ARRAY_REDUCTION_MAP`) lower onto handle methods;
// a REJECT (`percentile_nearest_rank`) or an unmapped `array.*` member over a
// slot emits a `Number.NaN` placeholder + an `array-reduction-not-mapped`
// diagnostic (so a future array builtin never silently mis-lowers to broken JS).
// Returns `null` only for a call that is not an `array.*` op over a slot (the
// generic recursion handles it).
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
            // Pine `array.get(coll, n)` indexes from the OLDEST element (index
            // 0 = first pushed; `array.shift` evicts index 0), whereas
            // chartlang `state.array.get(n)` indexes from the NEWEST (n = 0).
            // Invert the index so the translated read targets the SAME element
            // (Pine index 0 → chartlang `size - 1`). `array.first`/`array.last`
            // below already account for this; `get` must too.
            return `${slot}.get(${slot}.size - 1 - (${arg(1)}))`;
        case "array.size":
            return `${slot}.size`;
        case "array.last":
            return `${slot}.last()`;
        case "array.first":
            return `${slot}.get(${slot}.size - 1)`;
        case "array.clear":
            return `${slot}.clear()`;
        default: {
            if (!name.startsWith("array.")) {
                // A non-array dotted call whose first arg happens to name a slot
                // (e.g. `math.max(win, 5)`) — leave it to the generic path.
                return null;
            }
            const mapping = ARRAY_REDUCTION_MAP.get(name);
            if (mapping === undefined || mapping.chartlang === null) {
                // An unmapped `array.*` builtin or an explicit REJECT
                // (`percentile_nearest_rank`) — emit a safe placeholder, never
                // broken `array.<x>(...)`, and surface it.
                ctx.arrayWarn?.("array-reduction-not-mapped", call.span);
                return `Number.NaN /* TODO: ${name} not supported in chartlang */`;
            }
            if (mapping.arity === "sort") {
                // chartlang `sort` returns a fresh COPY (never mutates the ring):
                // `order.descending` → `"desc"`, ascending/default → bare `sort()`.
                ctx.arrayWarn?.("array-sort-returns-copy", call.span);
                return sortOrder(call) === "desc" ? `${slot}.sort("desc")` : `${slot}.sort()`;
            }
            // A no-arg reduction forwards nothing; `value` always forwards the
            // trailing arg; `optional` (variance/stdev `biased`) forwards it only
            // when present.
            const forwarded =
                mapping.arity === "value" ||
                (mapping.arity === "optional" && call.args[1] !== undefined)
                    ? arg(1)
                    : "";
            return `${slot}.${mapping.chartlang}(${forwarded})`;
        }
    }
}

// The chartlang sort direction of an `array.sort(id[, order])` call: a bare
// `order.*` enum arg resolves via `ARRAY_SORT_ORDER_MAP`; an omitted or
// unrecognised order defaults to ascending (chartlang's default).
function sortOrder(call: CallExpression): "asc" | "desc" {
    const order = call.args[1]?.value;
    if (order !== undefined && order.kind === "member-access-expression" && order.head === null) {
        return ARRAY_SORT_ORDER_MAP.get(order.chain.join(".")) ?? "asc";
    }
    return "asc";
}

// The chartlang `state.map` slot local a call's first argument targets, or
// `null` when the first arg is not a bare identifier naming a registered map
// slot.
function mapSlotOf(call: CallExpression, ctx: EmitContext): string | null {
    if (ctx.mapSlots === undefined) {
        return null;
    }
    const first = call.args[0]?.value;
    if (first === undefined || first.kind !== "identifier-expression") {
        return null;
    }
    return ctx.mapSlots.get(first.name)?.local ?? null;
}

// Rewrite a `map.*(id, …)` call over a registered `state.map` slot onto the
// slot's chartlang surface, returning the emitted source string. Trailing
// arguments are lowered recursively so a nested rewrite still applies. The
// member NAME comes from `MAP_BUILTIN_MAP` (the table owns the decision); the
// shape comes from its `form`. `map.get` is na-bridged (`?? Number.NaN`) since
// chartlang returns `undefined` where Pine returns `na`. `map.keys`/`map.values`
// (no v1 iterators) and any unmapped `map.*` over a slot emit a `Number.NaN`
// placeholder + a `map-builtin-not-mapped` diagnostic, never broken JS. Returns
// `null` for a call that is not a `map.*` op over a slot (the generic recursion
// handles it).
function rewriteMapBuiltin(call: CallExpression, ctx: EmitContext): string | null {
    const slot = mapSlotOf(call, ctx);
    const name = dottedCallee(call.callee);
    if (slot === null || name === null || !name.startsWith("map.")) {
        return null;
    }
    const arg = (index: number): string => {
        const value = call.args[index]?.value;
        return value === undefined ? "" : emitWithContext(value, ctx);
    };
    const entry = MAP_BUILTIN_MAP.get(name);
    if (entry === undefined || entry.chartlang === null) {
        // An unmapped `map.*` member or an explicit REJECT (`map.keys`/
        // `map.values`) — emit a safe placeholder, never broken `map.<x>(...)`,
        // and surface it.
        ctx.mapWarn?.("map-builtin-not-mapped", call.span);
        return `Number.NaN /* TODO: ${name} not supported in chartlang */`;
    }
    switch (entry.form) {
        case "put":
            return `${slot}.${entry.chartlang}(${arg(1)}, ${arg(2)})`;
        case "get":
            // chartlang `get` returns `undefined` for an absent key (Pine `na`);
            // bridge the read so a downstream numeric expression sees `NaN`.
            return `(${slot}.${entry.chartlang}(${arg(1)}) ?? Number.NaN)`;
        case "has":
        case "remove":
            return `${slot}.${entry.chartlang}(${arg(1)})`;
        case "size":
            // chartlang `size` is a PROPERTY (Pine `map.size(id)` is a call).
            return `${slot}.${entry.chartlang}`;
        case "clear":
            return `${slot}.${entry.chartlang}()`;
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
// still run. `scalar` marks a SCALAR (number-required) position — operator
// operands, ternary arms, scalar-call args — where a nested `ta.*` call lowers
// to its `(...).current` projection; a series position (a `plot`/`hline` value,
// a `ta.*` source arg, a `request.security` callback body, a history receiver)
// leaves the `ta.*` call a `Series`.
function rewriteTree(node: ExpressionNode, ctx: EmitContext, scalar: boolean): ExpressionNode {
    switch (node.kind) {
        case "identifier-expression": {
            const replacement = rewriteIdentifier(node.name, ctx);
            if (replacement !== null) {
                return { ...node, name: replacement };
            }
            // Inside a `request.security` expression callback, project an OHLCV
            // read to its `.current` scalar — the `SecurityBar` fields are
            // series-only, so `bar.close` is unusable in scalar arithmetic. A
            // shadowing local (e.g. an inlined UDF body local) is excluded so
            // only genuine OHLCV builtins are projected.
            if (ctx.securityExpr === true && !ctx.localNames.has(node.name)) {
                const mapped = remapIdentifier(node.name);
                if (mapped?.startsWith("bar.") === true) {
                    return { ...node, name: `${mapped}.current` };
                }
            }
            return node;
        }
        case "unary-expression":
            return { ...node, operand: rewriteTree(node.operand, ctx, true) };
        case "binary-expression":
            return {
                ...node,
                left: rewriteTree(node.left, ctx, true),
                right: rewriteTree(node.right, ctx, true),
            };
        case "ternary-expression":
            return {
                ...node,
                condition: rewriteTree(node.condition, ctx, true),
                consequent: rewriteTree(node.consequent, ctx, true),
                alternate: rewriteTree(node.alternate, ctx, true),
            };
        case "call-expression": {
            // An inline `input.*(...)` call promoted to a named top-level input
            // is rewritten at its use site to the `inputs.<name>` read (with the
            // same cast a bare input identifier gets). An un-rewritten
            // `input.*(...)` inside `compute` is invalid chartlang (the hole
            // throws at runtime; the positional title/step args mis-shape it).
            const promoted = ctx.promotedInline?.get(spanKey(node.span));
            if (promoted !== undefined) {
                const cast = ctx.inputCasts?.get(promoted);
                const source =
                    cast === undefined ? `inputs.${promoted}` : `(inputs.${promoted} as ${cast})`;
                return { kind: "identifier-expression", name: source, span: node.span };
            }
            // A nested `ta.*` call in a SCALAR position lowers to its current-bar
            // scalar (`ta.rsi(close,14) * 0.1` → `ta.rsi(bar.close, 14).current
            // * 0.1`). Routed through the SAME `lowerTaToCurrent` the top-level
            // `emitTa` uses (so `ta.rma` → `ta.smma`, pivots resolve) and spliced
            // as a verbatim identifier. A miss (non-`ta.*` / unmapped) falls
            // through; a series position (`scalar === false`) keeps the `Series`.
            if (scalar) {
                const taLowered = lowerTaToCurrent(node, ctx);
                if (taLowered !== null) {
                    ctx.taWarn?.("nested-ta-lowered", node.span);
                    return {
                        kind: "identifier-expression",
                        name: taLowered.source,
                        span: node.span,
                    };
                }
                // The residual-series safety net: a `ta.*` reached a scalar
                // position the rule could not lower (an unmapped / REJECT name,
                // `taLookup` → null). It falls through as a bare `Series`, so
                // surface it rather than leaking a silent type error.
                const scalarCallee = dottedCallee(node.callee);
                if (scalarCallee?.startsWith("ta.") === true) {
                    ctx.taWarn?.("nested-ta-not-lowered", node.span);
                }
            }
            // Lower an `array.*(coll, …)` operation over a numeric `state.array`
            // slot onto the slot's surface (`array.push(coll, v)` →
            // `<slot>.push(v)`). Spliced as a verbatim identifier so `emitExpr`
            // re-emits it as-is; a non-array-slot call falls through.
            const arrayLowered = rewriteArrayBuiltin(node, ctx);
            if (arrayLowered !== null) {
                return { kind: "identifier-expression", name: arrayLowered, span: node.span };
            }
            // Lower a `map.*(id, …)` operation over a numeric `state.map` slot
            // onto the slot's surface (`map.put(id, k, v)` → `<slot>.set(k, v)`).
            // Spliced as a verbatim identifier so `emitExpr` re-emits it as-is; a
            // non-map-slot call falls through.
            const mapLowered = rewriteMapBuiltin(node, ctx);
            if (mapLowered !== null) {
                return { kind: "identifier-expression", name: mapLowered, span: node.span };
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
            // A nested `math.*` call lowers its callee to the bare-native `Math.*`
            // passthrough (`math.max(math.min(a, b), c)` → `Math.max(Math.min(a,
            // b), c)`), mirroring the top-level `emitMath` simple case so the
            // undefined `math.min` member does not leak (chartlang's `math`
            // namespace has no `min`/`max`). Only the `Math.*`-targeted members
            // rewrite here; the chart-aware `math.*` targets (`math.avg`/
            // `math.sum`/`math.roundToMintick`) ARE real chartlang members and
            // stay as-is, leaving their rolling-window / mintick-injection
            // handling to the top-level `emitMath` path. Args recurse in scalar
            // position so a nested `ta.*`/`math.*` argument lowers too.
            const mathCallee = dottedCallee(node.callee);
            if (mathCallee?.startsWith("math.") === true) {
                const mathTarget = mathLookup(mathCallee)?.chartlang;
                if (mathTarget?.startsWith("Math.") === true) {
                    return {
                        ...node,
                        callee: {
                            kind: "identifier-expression",
                            name: mathTarget,
                            span: node.callee.span,
                        },
                        args: node.args.map((arg) => ({
                            ...arg,
                            value: rewriteTree(arg.value, ctx, true),
                        })),
                    };
                }
            }
            // A chartlang `ta.*` takes `Series<number>` sources, so its args are
            // a SERIES position (an inner `ta.*` source arg stays a `Series`);
            // every other call (`math.*`, a user function) takes scalar args.
            const calleeName = dottedCallee(node.callee);
            const argScalar = calleeName === null || !calleeName.startsWith("ta.");
            return {
                ...node,
                callee: rewriteTree(node.callee, ctx, false),
                args: node.args.map((arg) => ({
                    ...arg,
                    value: rewriteTree(arg.value, ctx, argScalar),
                })),
            };
        }
        case "member-access-expression":
            return node.head === null
                ? node
                : { ...node, head: rewriteTree(node.head, ctx, false) };
        case "history-access-expression": {
            // A `[n]` read of a `state.series` slot emits the BARE slot local
            // (`<slot>[n]`, a real series index), not the `.value`-rewritten
            // scalar (`<slot>.value[n]`, a typecheck error). The offset still
            // rewrites normally; the receiver of every OTHER history form is
            // rewritten by the generic recursion in SERIES position (a `ta.*`
            // receiver `ta.sma(close,20)[1]` indexes the `Series`).
            const seriesReceiver = seriesSlotReceiver(node.receiver, ctx);
            return {
                ...node,
                receiver:
                    seriesReceiver === null
                        ? rewriteTree(node.receiver, ctx, false)
                        : seriesReceiver,
                offset: rewriteTree(node.offset, ctx, true),
            };
        }
        case "paren-expression":
            return { ...node, expression: rewriteTree(node.expression, ctx, scalar) };
        case "tuple-expression":
        case "array-literal-expression":
            return { ...node, elements: node.elements.map((el) => rewriteTree(el, ctx, false)) };
        case "lambda-expression":
            return { ...node, body: rewriteTree(node.body, ctx, false) };
        case "na-expression": {
            // Inside a `request.security` expression callback the numeric `na`
            // sentinel must be the bare `NaN` global, NOT `Number.NaN`: the
            // chartlang compiler's `validateSecurityExpr` allows `NaN` (a pure
            // value global) but rejects `Number` as a captured outer binding.
            // The handle/`color` na flavours never reach a security callback (a
            // drawing/color value is not a security source), so only the numeric
            // flavour is remapped.
            const naKind = ctx.annotations.get(node)?.naKind;
            if (ctx.securityExpr === true && naKind !== "handle" && naKind !== "color") {
                return { kind: "identifier-expression", name: "NaN", span: node.span };
            }
            return node;
        }
        case "switch-expression":
            // A value-form `switch` yields a SCALAR value, so the subject, each
            // arm test, and each arm value are scalar positions (a nested `ta.*`
            // lowers to its `.current` projection).
            return {
                ...node,
                subject: node.subject === null ? null : rewriteTree(node.subject, ctx, true),
                cases: node.cases.map((arm) => ({
                    ...arm,
                    test: arm.test === null ? null : rewriteTree(arm.test, ctx, true),
                    value: rewriteTree(arm.value, ctx, true),
                })),
            };
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
    // A SERIES root position: a top-level `ta.*` call stays a `Series` (the
    // caller — `plot`/`hline`/`request.security`/`emitTa` — owns its handling);
    // nested scalar sub-positions still lower.
    return emitExpr(rewriteTree(node, ctx, false), ctx.annotations);
}

/**
 * Lower a Pine expression to a chartlang TS source string in a **scalar**
 * (number-required) root position — a `ta.*` call at the root lowers to its
 * `(...).current` projection. Same `EmitContext` rewrites as
 * {@link emitWithContext}; the only difference is the root position. Used for
 * scalar-typed call arguments (`math.*` / `Math.*`).
 *
 * @since 1.5
 * @stable
 * @example
 *     import { emitScalar } from "./emitContext.js";
 *     const ctx = {
 *         annotations: new Map(),
 *         inputNames: new Set<string>(),
 *         localNames: new Set<string>(),
 *         stateSlots: new Map<string, string>(),
 *     };
 *     const span = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 } as const;
 *     const call = {
 *         kind: "call-expression",
 *         callee: { kind: "member-access-expression", head: null, chain: ["ta", "atr"], span },
 *         args: [
 *             { name: null, value: { kind: "literal-expression", literalKind: "int", value: "14", span }, span },
 *         ],
 *         span,
 *     } as const;
 *     emitScalar(call, ctx); // "ta.atr(14).current"
 */
export function emitScalar(node: ExpressionNode, ctx: EmitContext): string {
    return emitExpr(rewriteTree(node, ctx, true), ctx.annotations);
}
