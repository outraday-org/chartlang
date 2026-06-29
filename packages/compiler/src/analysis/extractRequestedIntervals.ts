// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import {
    type RequestedFeed,
    type SecurityExpressionDescriptor,
    feedKey,
} from "@invinite-org/chartlang-core";
import ts from "typescript";

import { type CompileDiagnostic, createDiagnostic } from "../diagnostics.js";
import { callsiteIdFor } from "../transformers/callsiteIdInjection.js";
import { resolveCalleeName } from "../transformers/resolveCallee.js";
import type { ExtractedDescriptor } from "./extractInputs.js";
import { validateSecurityExpr } from "./validateSecurityExpr.js";

/**
 * Combined result of the `request.*` analysis pass: the sorted, deduped list
 * of requested intervals (the **main-symbol** projection), the sorted, deduped
 * list of requested `(symbol?, interval)` {@link RequestedFeed | feeds} (the
 * superset), plus one {@link SecurityExpressionDescriptor} per
 * `request.security({ interval }, (bar) => …)` expression callsite (sorted by
 * `slotId`).
 *
 * `intervals` keeps its exact existing meaning — the symbol-omitted
 * (chart-symbol) higher-timeframe intervals — so existing manifests stay
 * byte-identical. `feeds` adds the symbol dimension: one entry per distinct
 * `(symbol, interval)` pair, deduped + ordered by the shared
 * `feedKey(symbol, interval)` so the printed manifest is byte-stable.
 *
 * @since 0.7
 * @stable
 * @example
 *     const r: RequestAnalysis = { intervals: ["1W"], feeds: [], securityExpressions: [] };
 *     void r;
 */
export type RequestAnalysis = Readonly<{
    intervals: ReadonlyArray<string>;
    feeds: ReadonlyArray<RequestedFeed>;
    securityExpressions: ReadonlyArray<SecurityExpressionDescriptor>;
}>;

/**
 * Walk a script's AST and collect every static `interval` argument to
 * `request.security({ interval: ... })` and `request.lowerTf(...)`, every
 * distinct requested `(symbol?, interval)` feed (`request.security` only —
 * `request.lowerTf` has no symbol), plus every `request.security` *expression*
 * callsite (a second arrow/function argument). Dynamic intervals emit
 * `request-security-interval-not-literal` (for `request.security`) or
 * `request-lower-tf-interval-not-literal` (for `request.lowerTf`); a dynamic
 * `request.security` symbol emits `request-security-symbol-not-literal`. Either
 * dynamic axis is excluded.
 *
 * Both axes are read the same ways — a string literal, an `inputs.<enum>`
 * access (expanded to all options), or an `inputs.<name>` `input.symbol` /
 * `input.interval` default literal — and the cartesian product of resolved
 * symbols × intervals is deduped into `feeds` via the shared
 * `feedKey(symbol, interval)`. A symbol-omitted (or empty-literal) feed keeps its
 * interval in `intervals` (the main-symbol projection); a present-symbol feed
 * does not. An empty (`""`) interval is the chart timeframe: a chart-symbol +
 * chart-tf pair collapses onto the primary stream (no feed, no `intervals`
 * entry), while a present-symbol + chart-tf pair stays a distinct feed.
 *
 * Each expression callsite is recorded as a {@link SecurityExpressionDescriptor}
 * keyed by the same `slotId` the callsite-id transformer injects (via the
 * shared `callsiteIdFor` helper) so the runtime can match the manifest entry
 * to the inlined callback. When `validateExpressions` is `true`, each callback
 * is also run through {@link validateSecurityExpr}, pushing
 * `request-security-expr-captures-local` for any out-of-subset reference.
 *
 * @since 0.7
 * @stable
 * @example
 *     // const { intervals, feeds, securityExpressions } =
 *     //     extractRequestAnalysis(sf, checker, inputs, diagnostics, path, true);
 *     const fn: typeof extractRequestAnalysis = extractRequestAnalysis;
 *     void fn;
 */
export function extractRequestAnalysis(
    sourceFile: ts.SourceFile,
    checker: ts.TypeChecker,
    inputs: Readonly<Record<string, ExtractedDescriptor>>,
    diagnostics: CompileDiagnostic[],
    sourcePath: string = sourceFile.fileName,
    validateExpressions = false,
): RequestAnalysis {
    const intervals = new Set<string>();
    // Keyed by `feedKey(symbol, interval)` so the dedup format matches the
    // runtime/host stream key exactly and the sort below is byte-stable.
    const feeds = new Map<string, RequestedFeed>();
    const securityExpressions: SecurityExpressionDescriptor[] = [];

    const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node)) {
            const calleeName = resolveCalleeName(node, checker);
            if (calleeName === "request.security" || calleeName === "request.lowerTf") {
                readRequestInterval(
                    node,
                    calleeName,
                    sourceFile,
                    sourcePath,
                    inputs,
                    diagnostics,
                    intervals,
                    feeds,
                );
            }
            if (calleeName === "request.security") {
                readSecurityExpression(
                    node,
                    sourceFile,
                    sourcePath,
                    checker,
                    diagnostics,
                    validateExpressions,
                    inputs,
                    securityExpressions,
                );
            }
        }
        ts.forEachChild(node, visit);
    };

    ts.forEachChild(sourceFile, visit);
    securityExpressions.sort((a, b) => a.slotId.localeCompare(b.slotId));
    const sortedFeeds = Array.from(feeds.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, feed]) => feed);
    return Object.freeze({
        intervals: Object.freeze(Array.from(intervals).sort()),
        feeds: Object.freeze(sortedFeeds),
        securityExpressions: Object.freeze(securityExpressions.slice()),
    });
}

/**
 * Walk a script's AST and collect every static `interval` argument to
 * `request.security({ interval: ... })` and `request.lowerTf(...)`. Dynamic
 * arguments emit `request-security-interval-not-literal` (for `request.security`)
 * or `request-lower-tf-interval-not-literal` (for `request.lowerTf`) and are
 * excluded. Thin delegate over {@link extractRequestAnalysis} kept for callers
 * that only need the interval list.
 *
 * @since 0.4
 * @example
 *     // const intervals = extractRequestedIntervals(sf, checker, inputs, diagnostics);
 *     // intervals === ["1D", "5m"];
 *     const fn: typeof extractRequestedIntervals = extractRequestedIntervals;
 *     void fn;
 */
export function extractRequestedIntervals(
    sourceFile: ts.SourceFile,
    checker: ts.TypeChecker,
    inputs: Readonly<Record<string, ExtractedDescriptor>>,
    diagnostics: CompileDiagnostic[],
    sourcePath: string = sourceFile.fileName,
): ReadonlyArray<string> {
    return extractRequestAnalysis(sourceFile, checker, inputs, diagnostics, sourcePath).intervals;
}

/**
 * Detect and record a `request.security` expression callsite — a second
 * argument that is an arrow or function expression. Mints the descriptor's
 * `slotId` via `callsiteIdFor` (lockstep with the injector), reads the
 * `interval` (string literal or `input.interval` default — an `input.enum`
 * interval can't anchor a single clock, and an empty `""` default is the chart
 * timeframe, the main clock, not an HTF expression clock), the `symbol` (string
 * literal or `input.symbol` default — an `input.enum`/dynamic symbol can't
 * anchor one), and the callback's single parameter name, and — when `validate`
 * — runs the capture check. A callsite whose interval is not a compile-time
 * literal already emitted `request-security-interval-not-literal` via
 * `readRequestInterval`; it is skipped here (no descriptor).
 */
function readSecurityExpression(
    call: ts.CallExpression,
    sourceFile: ts.SourceFile,
    sourcePath: string,
    checker: ts.TypeChecker,
    diagnostics: CompileDiagnostic[],
    validate: boolean,
    inputs: Readonly<Record<string, ExtractedDescriptor>>,
    out: SecurityExpressionDescriptor[],
): void {
    const callback = call.arguments[1];
    if (
        callback === undefined ||
        !(ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))
    ) {
        return;
    }
    if (validate) {
        validateSecurityExpr(callback, checker, diagnostics, sourcePath);
    }
    const opts = call.arguments[0];
    if (opts === undefined || !ts.isObjectLiteralExpression(opts)) return;
    const interval = readLiteralInterval(opts, inputs);
    if (interval === null) return;
    const symbol = readLiteralSymbol(opts, inputs);
    const firstParam = callback.parameters[0];
    const paramName =
        firstParam !== undefined && ts.isIdentifier(firstParam.name) ? firstParam.name.text : "";
    out.push(
        Object.freeze({
            slotId: callsiteIdFor(sourceFile, call, sourcePath),
            ...(symbol === undefined ? {} : { symbol }),
            interval,
            paramName,
        }),
    );
}

/**
 * Read the literal `interval` off a `request.security` opts object for the
 * expression-descriptor anchor, or `null` when it is absent / non-literal /
 * unable to anchor a single clock. A string literal or an `input.interval`
 * default resolves to a concrete interval (mirroring `readLiteralSymbol`'s
 * `input.symbol`-default path); an `input.enum` interval is multi-valued so it
 * cannot anchor one clock, and an empty (`""`) default is the chart timeframe —
 * the main clock, not a higher-timeframe expression clock — so both resolve to
 * `null` (no expression unit).
 */
function readLiteralInterval(
    opts: ts.ObjectLiteralExpression,
    inputs: Readonly<Record<string, ExtractedDescriptor>>,
): string | null {
    const resolved = resolveOptString(opts, "interval", inputs);
    if (resolved.kind === "literal" || resolved.kind === "input-default") {
        return resolved.value === "" ? null : resolved.value;
    }
    return null;
}

/**
 * Read the literal `symbol` off a `request.security` opts object for the
 * expression-descriptor anchor: a string literal or an `input.symbol` default
 * resolves to a concrete symbol; an empty literal, an `input.enum`/dynamic
 * symbol, or an absent property resolves to `undefined` (the chart symbol —
 * an enum/dynamic symbol can't anchor a single expression clock). Never pushes
 * a diagnostic; `readRequestInterval` already reported any dynamic symbol.
 */
function readLiteralSymbol(
    opts: ts.ObjectLiteralExpression,
    inputs: Readonly<Record<string, ExtractedDescriptor>>,
): string | undefined {
    const resolved = resolveOptString(opts, "symbol", inputs);
    if (resolved.kind === "literal" || resolved.kind === "input-default") {
        return resolved.value === "" ? undefined : resolved.value;
    }
    return undefined;
}

/**
 * Resolution of an opts string property read four ways: a string literal, the
 * options of an `inputs.<enum>` access, the **default** of an `inputs.<name>`
 * `input.symbol` / `input.interval` access (the kind selected per `propName` —
 * `"interval"` reads an `input.interval` default, every other property reads an
 * `input.symbol` default), an absent property, or a genuinely-dynamic
 * expression.
 */
type ResolvedOptString =
    | Readonly<{ kind: "literal"; value: string }>
    | Readonly<{ kind: "enum"; values: ReadonlyArray<string> }>
    | Readonly<{ kind: "input-default"; value: string }>
    | Readonly<{ kind: "absent" }>
    | Readonly<{ kind: "dynamic"; node: ts.Expression }>;

function resolveOptString(
    opts: ts.ObjectLiteralExpression,
    propName: string,
    inputs: Readonly<Record<string, ExtractedDescriptor>>,
): ResolvedOptString {
    const property = opts.properties
        .filter(ts.isPropertyAssignment)
        .find((p) => ts.isIdentifier(p.name) && p.name.text === propName);
    if (property === undefined) return { kind: "absent" };

    const initializer = property.initializer;
    if (ts.isStringLiteral(initializer)) return { kind: "literal", value: initializer.text };

    const enumOptions = getInputsEnumOptions(initializer, inputs);
    if (enumOptions !== null) return { kind: "enum", values: enumOptions };

    const inputDefault = getInputDefault(
        initializer,
        inputs,
        propName === "interval" ? "interval" : "symbol",
    );
    if (inputDefault !== null) return { kind: "input-default", value: inputDefault };

    return { kind: "dynamic", node: initializer };
}

function readRequestInterval(
    call: ts.CallExpression,
    calleeName: "request.security" | "request.lowerTf",
    sourceFile: ts.SourceFile,
    sourcePath: string,
    inputs: Readonly<Record<string, ExtractedDescriptor>>,
    diagnostics: CompileDiagnostic[],
    intervals: Set<string>,
    feeds: Map<string, RequestedFeed>,
): void {
    const opts = call.arguments[0];
    if (opts === undefined || !ts.isObjectLiteralExpression(opts)) return;
    const intervalProperty = opts.properties
        .filter(ts.isPropertyAssignment)
        .find((property) => ts.isIdentifier(property.name) && property.name.text === "interval");
    if (intervalProperty === undefined) return;

    const resolvedIntervals = resolveIntervals(intervalProperty.initializer, inputs);
    if (resolvedIntervals === null) {
        diagnostics.push(
            createDiagnostic({
                severity: "error",
                code:
                    calleeName === "request.lowerTf"
                        ? "request-lower-tf-interval-not-literal"
                        : "request-security-interval-not-literal",
                message: `${calleeName}({ interval }) must be a string literal or input.enum value`,
                file: sourcePath,
                node: intervalProperty.initializer,
                sourceFile,
            }),
        );
    }

    // `request.lowerTf` has no symbol dimension: it only ever feeds intervals
    // (the chart-symbol HTF projection), never `feeds`. Preserve its existing
    // interval-only behavior exactly.
    if (calleeName === "request.lowerTf") {
        for (const interval of resolvedIntervals ?? []) intervals.add(interval);
        return;
    }

    const resolvedSymbols = resolveSymbols(opts, inputs, sourceFile, sourcePath, diagnostics);
    for (const symbol of resolvedSymbols) {
        for (const interval of resolvedIntervals ?? []) {
            // An empty interval is the chart's own timeframe (Pine's empty
            // `request.security` tf, here an `input.interval("")` default).
            // Combined with the chart symbol (symbol omitted) it IS the primary
            // stream — never a secondary feed, and not a higher-timeframe entry
            // in the main-symbol projection. A present (different) symbol at the
            // chart timeframe stays a distinct feed (a different instrument on
            // the chart's own clock).
            if (symbol === undefined && interval === "") continue;
            // A symbol-omitted (chart-symbol) feed keeps its interval in the
            // main-symbol projection; a present-symbol feed does not.
            if (symbol === undefined) intervals.add(interval);
            feeds.set(feedKey(symbol, interval), {
                ...(symbol === undefined ? {} : { symbol }),
                interval,
            });
        }
    }
}

/**
 * Resolve a `request.*` `interval` initializer to its concrete interval list —
 * a single-element list for a string literal, all options for an `inputs.<enum>`
 * access, a single-element list for an `inputs.<name>` `input.interval`
 * **default** (an empty default `""` ⇒ the chart timeframe; the feed loop
 * collapses a chart-symbol + chart-tf pair onto the primary stream) — or `null`
 * for a genuinely-dynamic interval (the caller pushes the appropriate
 * diagnostic). This mirrors the `input.symbol`-default path the `symbol` axis
 * already accepts.
 */
function resolveIntervals(
    initializer: ts.Expression,
    inputs: Readonly<Record<string, ExtractedDescriptor>>,
): ReadonlyArray<string> | null {
    if (ts.isStringLiteral(initializer)) return [initializer.text];
    const enumOptions = getInputsEnumOptions(initializer, inputs);
    if (enumOptions !== null) return enumOptions;
    const intervalDefault = getInputDefault(initializer, inputs, "interval");
    if (intervalDefault !== null) return [intervalDefault];
    return null;
}

/**
 * Resolve a `request.security` opts object's `symbol` axis to the list of
 * requested symbols (`undefined` ⇒ the chart's own symbol): `[undefined]` when
 * absent or an empty literal, `[value]` for a string literal or `input.symbol`
 * default, all options for an `inputs.<enum>` access, or `[]` (excluded, after
 * pushing `request-security-symbol-not-literal`) for a dynamic symbol.
 */
function resolveSymbols(
    opts: ts.ObjectLiteralExpression,
    inputs: Readonly<Record<string, ExtractedDescriptor>>,
    sourceFile: ts.SourceFile,
    sourcePath: string,
    diagnostics: CompileDiagnostic[],
): ReadonlyArray<string | undefined> {
    const resolved = resolveOptString(opts, "symbol", inputs);
    switch (resolved.kind) {
        case "absent":
            return [undefined];
        case "literal":
            // An empty-literal symbol collapses to the chart symbol, matching
            // `feedKey`'s empty-collapse.
            return [resolved.value === "" ? undefined : resolved.value];
        case "input-default":
            return [resolved.value];
        case "enum":
            return resolved.values;
        default:
            diagnostics.push(
                createDiagnostic({
                    severity: "error",
                    code: "request-security-symbol-not-literal",
                    message:
                        "request.security({ symbol }) must be a string literal, an input.symbol default, or an input.enum value",
                    file: sourcePath,
                    node: resolved.node,
                    sourceFile,
                }),
            );
            return [];
    }
}

/**
 * Strip the parentheses + `as` casts a generated source may wrap an
 * `inputs.<name>` access in. The pine-converter emits an input-bound feed as
 * `inputs.<name> as string` (the script's `compute` context types `inputs`
 * loosely, so an un-cast read fails the `RequestSecurityOpts` typecheck); the
 * feed extractor must see through that cast to the `inputs.<name>` access to
 * resolve the default. Hand-written `inputs.<name>` (no cast) is unchanged.
 */
function unwrapInputAccess(expr: ts.Expression): ts.Expression {
    let current = expr;
    while (ts.isParenthesizedExpression(current) || ts.isAsExpression(current)) {
        current = current.expression;
    }
    return current;
}

/**
 * Resolve an `inputs.<name>` access whose descriptor is an `input.symbol` (for
 * the `symbol` axis) or an `input.interval` (for the `interval` axis) to its
 * `defaultValue` string, or `null` when the access is not an `inputs.<name>`
 * property access, the descriptor is missing / not the requested `kind`, or its
 * `defaultValue` is not a string. The `symbol` and `interval` axes share this
 * one helper so the two feed-default paths can never drift.
 */
function getInputDefault(
    expr: ts.Expression,
    inputs: Readonly<Record<string, ExtractedDescriptor>>,
    descriptorKind: "symbol" | "interval",
): string | null {
    const access = unwrapInputAccess(expr);
    if (
        !ts.isPropertyAccessExpression(access) ||
        !ts.isIdentifier(access.expression) ||
        access.expression.text !== "inputs"
    ) {
        return null;
    }
    const descriptor = inputs[access.name.text];
    if (descriptor === undefined || descriptor.kind !== descriptorKind) return null;
    const defaultValue = descriptor.defaultValue;
    return typeof defaultValue === "string" ? defaultValue : null;
}

function getInputsEnumOptions(
    expr: ts.Expression,
    inputs: Readonly<Record<string, ExtractedDescriptor>>,
): ReadonlyArray<string> | null {
    const access = unwrapInputAccess(expr);
    if (
        !ts.isPropertyAccessExpression(access) ||
        !ts.isIdentifier(access.expression) ||
        access.expression.text !== "inputs"
    ) {
        return null;
    }
    const descriptor = inputs[access.name.text];
    if (descriptor === undefined || descriptor.kind !== "enum") return null;
    const options = descriptor.options;
    if (!Array.isArray(options)) return null;
    const strings: string[] = [];
    for (const option of options) {
        if (typeof option !== "string") return null;
        strings.push(option);
    }
    return Object.freeze(strings);
}
