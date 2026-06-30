// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CallExpression, ExpressionNode, LiteralKind } from "../ast/index.js";
import type { Argument } from "../ast/script.js";
import type { Statement } from "../ast/statements.js";
import type { SourceSpan } from "../index.js";
import { INPUT_DISPLAY_MAP, STRING_OPTIONS_ENUM_BUILDER, inputLookup } from "../mapping/index.js";
import type { EnumTypeInfo, SemanticResult } from "../semantic/index.js";
import { positionalArgs, spanKey } from "./callArgs.js";
import type { DiagnosticCollector } from "./diagnosticCollector.js";
import { resolveEnumMemberValue, resolveEnumType } from "./enumMembers.js";
import type { InputDeclarationIR, ScriptScaffold } from "./ir.js";
import { appendInput } from "./scaffoldMutators.js";
import { pineTimeframeToInterval } from "./timeframeConvert.js";

// Pine `input.source` OHLCV / synthetic-aggregate built-ins → the chartlang
// `SourceField` string literal they lower to. Any other source expression is
// an error (`non-literal-source-input`).
const SOURCE_FIELDS: ReadonlySet<string> = new Set([
    "open",
    "high",
    "low",
    "close",
    "volume",
    "hl2",
    "hlc3",
    "ohlc4",
    "hlcc4",
]);

// Pine named-argument keys that carry a numeric range/step option onto the
// chartlang descriptor's options object.
const RANGE_ARG_TO_OPTION: ReadonlyMap<string, "min" | "max" | "step"> = new Map([
    ["minval", "min"],
    ["maxval", "max"],
    ["step", "step"],
]);

// Pine input metadata string args that map 1:1 to chartlang input opts.
const STRING_PASSTHROUGH_ARGS: ReadonlyMap<string, string> = new Map([
    ["title", "title"],
    ["group", "group"],
    ["inline", "inline"],
    ["tooltip", "tooltip"],
]);

// The Pine `input.*` member key (`"input.int"`) for a call whose callee is
// a `member-access-expression` `chain: ["input", <kind>]`, or `null` when
// the call is not an `input.*` primitive.
function inputCalleeKey(call: CallExpression): string | null {
    const callee = call.callee;
    // The bare generic `input(...)` form (callee identifier `input`); the
    // source-vs-typed target is decided in `buildBareInput`.
    if (callee.kind === "identifier-expression" && callee.name === "input") {
        return "input";
    }
    if (
        callee.kind === "member-access-expression" &&
        callee.head === null &&
        callee.chain.length === 2 &&
        callee.chain[0] === "input"
    ) {
        return `input.${callee.chain[1]}`;
    }
    return null;
}

// The Pine `input.*` key for an expression, or `null` when it is not an
// `input.*` primitive call.
function inputCallKey(node: ExpressionNode): string | null {
    return node.kind === "call-expression" ? inputCalleeKey(node) : null;
}

// A chartlang TypeScript string literal for a Pine string-literal value.
// `LiteralExpression.value` for a string carries its surrounding quotes
// verbatim (the raw lexeme), so re-quote through JSON to normalise to
// double quotes and escape the inner content.
function stringLiteralOf(node: ExpressionNode): string | null {
    if (node.kind === "literal-expression" && node.literalKind === "string") {
        return JSON.stringify(node.value.slice(1, -1));
    }
    return null;
}

// The chartlang default-value source string for a non-source input default.
// Allowed forms are compile-time literals (int/float/string/color/bool) and
// a unary `+`/`-` applied to a numeric literal (`input.int(-1)`); anything
// else is rejected by the caller.
function literalDefault(node: ExpressionNode): string | null {
    if (node.kind === "literal-expression") {
        if (node.literalKind === "string") {
            return JSON.stringify(node.value.slice(1, -1));
        }
        if (node.literalKind === "color") {
            return JSON.stringify(node.value);
        }
        return node.value;
    }
    if (
        node.kind === "unary-expression" &&
        node.operator !== "not" &&
        node.operand.kind === "literal-expression" &&
        (node.operand.literalKind === "int" || node.operand.literalKind === "float")
    ) {
        return `${node.operator}${node.operand.value}`;
    }
    return null;
}

// The chartlang source for a boolean literal input option.
function booleanLiteralOf(node: ExpressionNode): string | null {
    if (node.kind === "literal-expression" && node.literalKind === "bool") {
        return node.value;
    }
    return null;
}

// The Pine `display.<member>` member name for an input `display=` option, or
// `null` when the value is not a bare display member.
function inputDisplayMember(node: ExpressionNode): string | null {
    if (
        node.kind === "member-access-expression" &&
        node.head === null &&
        node.chain.length === 2 &&
        node.chain[0] === "display"
    ) {
        return node.chain.join(".").slice("display.".length);
    }
    return null;
}

// Split a call's argument list into the leading positional default value (or
// `null` if absent) and the named arguments by key. Pine's `input.*` defval
// is always the first positional argument.
type SplitArgs = Readonly<{
    defaultArg: Argument | null;
    named: ReadonlyMap<string, Argument>;
}>;

function splitArgs(call: CallExpression): SplitArgs {
    let defaultArg: Argument | null = null;
    const named = new Map<string, Argument>();
    for (const arg of call.args) {
        if (arg.name === null) {
            if (defaultArg === null) {
                defaultArg = arg;
            }
            continue;
        }
        named.set(arg.name, arg);
    }
    return { defaultArg, named };
}

// Warn once per distinct unmapped input-argument NAME across the whole script.
// Pine carries UI metadata (`group`/`inline`/`tooltip`/`confirm`/…) on every
// input that chartlang's `InputOptionsObject` (title/min/max/step/multiline)
// cannot model; reporting each name once — at its first occurrence, naming the
// arg — keeps the diagnostic honest without flooding one warning per call site.
function warnUnmappedInputArg(
    diagnostics: DiagnosticCollector,
    name: string,
    span: SourceSpan,
): void {
    diagnostics.pushCodeOnce(
        "input-arg-not-mapped",
        name,
        span,
        `The \`${name}\` input argument has no chartlang analogue and was dropped.`,
    );
}

// Warn once per distinct input-argument NAME whose chartlang option IS modelled
// (`title`/`minval`/`maxval`/`step`) but whose VALUE is not a compile-time
// literal, so the arg was dropped. Shares the `input-arg-not-mapped` code +
// per-name consolidation with {@link warnUnmappedInputArg}; the distinct message
// keeps the cause (a non-literal value, not "no analogue") accurate. The two
// helpers never key the same name (the generic walk excludes `title` and the
// range args), so each name resolves to exactly one message.
function warnNonLiteralInputArg(
    diagnostics: DiagnosticCollector,
    name: string,
    span: SourceSpan,
): void {
    diagnostics.pushCodeOnce(
        "input-arg-not-mapped",
        name,
        span,
        `The \`${name}\` input argument was dropped; its value is not a compile-time literal.`,
    );
}

function isInputMetadataArg(name: string): boolean {
    return STRING_PASSTHROUGH_ARGS.has(name) || name === "display" || name === "confirm";
}

function isRecognizedInputOptionArg(name: string): boolean {
    return isInputMetadataArg(name) || RANGE_ARG_TO_OPTION.has(name);
}

function appendStringOptions(
    parts: string[],
    named: ReadonlyMap<string, Argument>,
    diagnostics: DiagnosticCollector,
    positionalTitleArg: Argument | undefined,
): void {
    for (const [argName, option] of STRING_PASSTHROUGH_ARGS) {
        const arg =
            argName === "title" ? (named.get("title") ?? positionalTitleArg) : named.get(argName);
        if (arg === undefined) {
            continue;
        }
        const value = stringLiteralOf(arg.value);
        if (value !== null) {
            parts.push(`${option}: ${value}`);
        } else {
            warnNonLiteralInputArg(diagnostics, argName, arg.span);
        }
    }
}

function appendRangeOptions(
    parts: string[],
    named: ReadonlyMap<string, Argument>,
    diagnostics: DiagnosticCollector,
): void {
    for (const [argName, option] of RANGE_ARG_TO_OPTION) {
        const arg = named.get(argName);
        if (arg === undefined) {
            continue;
        }
        const value = literalDefault(arg.value);
        if (value !== null) {
            parts.push(`${option}: ${value}`);
        } else {
            warnNonLiteralInputArg(diagnostics, argName, arg.span);
        }
    }
}

function appendConfirmOption(
    parts: string[],
    named: ReadonlyMap<string, Argument>,
    diagnostics: DiagnosticCollector,
): void {
    const arg = named.get("confirm");
    if (arg === undefined) {
        return;
    }
    const value = booleanLiteralOf(arg.value);
    if (value !== null) {
        parts.push(`confirm: ${value}`);
    } else {
        warnNonLiteralInputArg(diagnostics, "confirm", arg.span);
    }
}

function appendDisplayOption(
    parts: string[],
    named: ReadonlyMap<string, Argument>,
    diagnostics: DiagnosticCollector,
): void {
    const arg = named.get("display");
    if (arg === undefined) {
        return;
    }
    const member = inputDisplayMember(arg.value);
    const value = member === null ? undefined : INPUT_DISPLAY_MAP.get(member);
    if (value === undefined) {
        warnUnmappedInputArg(diagnostics, "display", arg.span);
        return;
    }
    if (value !== "all") {
        parts.push(`display: ${JSON.stringify(value)}`);
    }
}

function appendUnmappedInputArgDiagnostics(
    named: ReadonlyMap<string, Argument>,
    diagnostics: DiagnosticCollector,
    skipOptionsArg: boolean,
): void {
    for (const [argName, arg] of named) {
        // A non-literal/mixed `options=` list was already reported by the enum
        // bridge (`input-string-options-not-literal`) and dropped, so it must
        // not double-warn here.
        if (skipOptionsArg && argName === "options") {
            continue;
        }
        if (!isRecognizedInputOptionArg(argName)) {
            warnUnmappedInputArg(diagnostics, argName, arg.span);
        }
    }
}

// Build the chartlang options-object source (`{ title: "X", min: 1 }`) from
// the named args, or `null` when no recognised option is present. Unmapped
// named args (`active`, unknowns, wrong-shape `display`) raise
// `input-arg-not-mapped` once per distinct argument name across the script.
// `multiline` is forced on for a `text_area` source.
function buildOptions(
    named: ReadonlyMap<string, Argument>,
    multiline: boolean,
    diagnostics: DiagnosticCollector,
    skipOptionsArg: boolean,
): string | null {
    const parts: string[] = [];
    appendStringOptions(parts, named, diagnostics, undefined);
    appendRangeOptions(parts, named, diagnostics);
    appendDisplayOption(parts, named, diagnostics);
    appendConfirmOption(parts, named, diagnostics);
    appendUnmappedInputArgDiagnostics(named, diagnostics, skipOptionsArg);
    if (multiline) {
        parts.push("multiline: true");
    }
    return parts.length === 0 ? null : `{ ${parts.join(", ")} }`;
}

// The chartlang default-value source for an `input.source` call: the OHLCV
// built-in as a quoted `SourceField` literal, or `null` when the source is
// a non-built-in expression (the caller rejects).
function sourceDefault(node: ExpressionNode): string | null {
    if (node.kind === "identifier-expression" && SOURCE_FIELDS.has(node.name)) {
        return JSON.stringify(node.name);
    }
    return null;
}

// The chartlang default-value source for an `input.timeframe` call: the Pine
// timeframe string converted to a chartlang interval literal. An empty `""`
// default is Pine's "chart timeframe" — a literal, not a missing default — so it
// maps to the chartlang chart-interval sentinel `""` (the Task-3 compiler reads
// it as the chart timeframe). Returns `null` only when the default is not a
// string literal (a computed expr) or an unknown timeframe (the caller rejects).
function timeframeDefault(node: ExpressionNode): string | null {
    const raw = stringLiteralOf(node);
    if (raw === null) {
        return null;
    }
    const pine = JSON.parse(raw) as string;
    if (pine === "") {
        return JSON.stringify("");
    }
    const interval = pineTimeframeToInterval(pine);
    return interval === null ? null : JSON.stringify(interval);
}

// Resolve the chartlang default-value source for a given Pine primitive +
// default expression. `null` means the default is unconvertible and the
// caller has already pushed the matching diagnostic.
function resolveDefault(
    primitive: string,
    defaultArg: Argument | null,
    span: SourceSpan,
    diagnostics: DiagnosticCollector,
): string | null {
    if (defaultArg === null) {
        return null;
    }
    const value = defaultArg.value;
    if (primitive === "input.source") {
        const source = sourceDefault(value);
        if (source === null) {
            diagnostics.pushCode("non-literal-source-input", span);
        }
        return source;
    }
    if (primitive === "input.timeframe") {
        const tf = timeframeDefault(value);
        if (tf === null) {
            diagnostics.pushCode("non-literal-input-default", span);
        }
        return tf;
    }
    const literal = literalDefault(value);
    if (literal === null) {
        diagnostics.pushCode("non-literal-input-default", span);
    }
    return literal;
}

// Whether every element of a `[…]` options list is a numeric (int/float)
// literal. Vacuously true for an empty list — an empty `options=[]` is not a
// string dropdown, so it routes to the numeric/defer path rather than emitting
// a degenerate `input.enum(x, [])`.
function everyOptionNumericLiteral(elements: readonly ExpressionNode[]): boolean {
    return elements.every(
        (el) =>
            el.kind === "literal-expression" &&
            (el.literalKind === "int" || el.literalKind === "float"),
    );
}

// Whether every element of a `[…]` options list is a string literal. The
// numeric-dropdown's cross-type guard: a numeric `input.int/float` whose
// `options=` are all strings (or the vacuous empty `[]`) is not a numeric enum,
// so it DEFERS to the generic path (the strings drop as `input-arg-not-mapped`)
// rather than reporting a malformed list.
function everyOptionStringLiteral(elements: readonly ExpressionNode[]): boolean {
    return elements.every((el) => el.kind === "literal-expression" && el.literalKind === "string");
}

// The chartlang source for a numeric (int/float) option-list element or default
// value, or `null` when the node is not a plain numeric literal.
function numericLiteralOf(node: ExpressionNode): string | null {
    if (
        node.kind === "literal-expression" &&
        (node.literalKind === "int" || node.literalKind === "float")
    ) {
        return node.value;
    }
    return null;
}

// The chartlang `{ ... }` opts fragment for a converter-synthesised enum,
// threaded from the same named metadata args as normal inputs. `title` also
// falls back to the 2nd positional arg (Pine `input.string(default, title, …)`).
// Returns the leading `, ` included, or `""` when there is no usable option.
function buildEnumOpts(
    call: CallExpression,
    named: ReadonlyMap<string, Argument>,
    diagnostics: DiagnosticCollector,
): string {
    const positional = positionalArgs(call.args);
    const positionalTitle = positional.length >= 2 ? positional[1] : undefined;
    const parts: string[] = [];
    appendStringOptions(parts, named, diagnostics, positionalTitle);
    appendDisplayOption(parts, named, diagnostics);
    appendConfirmOption(parts, named, diagnostics);
    return parts.length === 0 ? "" : `, { ${parts.join(", ")} }`;
}

function warnUnmappedEnumArgs(
    named: ReadonlyMap<string, Argument>,
    diagnostics: DiagnosticCollector,
): void {
    for (const [argName, arg] of named) {
        if (argName !== "options" && !isInputMetadataArg(argName)) {
            warnUnmappedInputArg(diagnostics, argName, arg.span);
        }
    }
}

// The outcome of inspecting an `input.string` `options=` named arg. `enum` is a
// ready chartlang `input.enum(...)` source string; `fallback` means a
// non-literal/mixed list was dropped (diagnostic already pushed) and the caller
// should emit a plain `input.string`, skipping the `options` arg; `defer` means
// there is nothing enum-specific here (no options, or numeric options — Task 4)
// so the normal path handles the call unchanged.
type StringOptionsResult =
    | Readonly<{ kind: "enum"; code: string }>
    | Readonly<{ kind: "fallback" }>
    | Readonly<{ kind: "defer" }>;

// How an `options=[…]` dropdown is bridged to `input.enum`, parameterised by the
// option element type. `element` extracts one option-list literal (or `null`
// when it is the wrong type); `defaultLiteral` extracts the default value source;
// `deferElements` is the cross-type guard — when the whole list is the OTHER
// element type (or empty), the call DEFERS to the generic path instead of
// reporting a malformed list.
type OptionsConfig = Readonly<{
    element: (node: ExpressionNode) => string | null;
    defaultLiteral: (node: ExpressionNode) => string | null;
    deferElements: (elements: readonly ExpressionNode[]) => boolean;
    matchesDefault: (option: string, defaultLiteral: string) => boolean;
}>;

// A Pine `input.string(default, title?, options=[string literals])` dropdown.
const STRING_OPTIONS_CONFIG: OptionsConfig = {
    element: stringLiteralOf,
    defaultLiteral: literalDefault,
    deferElements: everyOptionNumericLiteral,
    matchesDefault: (option, defaultLiteral) => option === defaultLiteral,
};

// A Pine `input.int/float(default, options=[numeric literals])` dropdown →
// chartlang `input.enum<number>` (the numeric form Task 1 widened core for).
const NUMERIC_OPTIONS_CONFIG: OptionsConfig = {
    element: numericLiteralOf,
    defaultLiteral: literalDefault,
    deferElements: everyOptionStringLiteral,
    // Compare numerically, not by raw token text: a `2` default against a
    // `2.0` option (or vice versa) is the SAME value, so it must not trip the
    // default-mismatch warning.
    matchesDefault: (option, defaultLiteral) => Number(option) === Number(defaultLiteral),
};

// The Pine `input.*` primitives that carry an `options=[…]` dropdown the
// converter bridges onto `input.enum`, mapped to their element-type config.
const OPTIONS_DROPDOWN_CONFIG: ReadonlyMap<string, OptionsConfig> = new Map([
    ["input.string", STRING_OPTIONS_CONFIG],
    ["input.int", NUMERIC_OPTIONS_CONFIG],
    ["input.float", NUMERIC_OPTIONS_CONFIG],
]);

// Bridge a Pine `input.*(default, title?, options=[literals])` dropdown onto
// chartlang `input.enum(default, [literals], { title? })`, for the element type
// the `config` selects (string or numeric).
function resolveOptionsEnum(
    call: CallExpression,
    defaultArg: Argument | null,
    named: ReadonlyMap<string, Argument>,
    diagnostics: DiagnosticCollector,
    config: OptionsConfig,
): StringOptionsResult {
    const optionsArg = named.get("options");
    if (optionsArg === undefined || optionsArg.value.kind !== "array-literal-expression") {
        return { kind: "defer" };
    }
    const optionLiterals: string[] = [];
    let allMatch = true;
    for (const element of optionsArg.value.elements) {
        const literal = config.element(element);
        if (literal === null) {
            allMatch = false;
            break;
        }
        optionLiterals.push(literal);
    }
    if (!allMatch || optionLiterals.length === 0) {
        // A list that is wholly the OTHER element type (or the vacuous empty
        // list) is not this dropdown's enum — let the generic path drop the
        // options with `input-arg-not-mapped`. A mixed / non-literal list cannot
        // become an enum at all.
        if (config.deferElements(optionsArg.value.elements)) {
            return { kind: "defer" };
        }
        diagnostics.pushCode("input-string-options-not-literal", optionsArg.span);
        return { kind: "fallback" };
    }
    const defaultLiteral = defaultArg === null ? null : config.defaultLiteral(defaultArg.value);
    if (defaultLiteral === null) {
        // A missing / non-literal default is rejected by the normal path
        // (`non-literal-input-default`); don't pre-empt that here.
        return { kind: "defer" };
    }
    if (!optionLiterals.some((option) => config.matchesDefault(option, defaultLiteral))) {
        diagnostics.pushCode("input-string-options-default-mismatch", call.span);
    }
    // Any other named arg has no enum analogue.
    warnUnmappedEnumArgs(named, diagnostics);
    const optionsOpt = buildEnumOpts(call, named, diagnostics);
    return {
        kind: "enum",
        code: `${STRING_OPTIONS_ENUM_BUILDER}(${defaultLiteral}, [${optionLiterals.join(", ")}]${optionsOpt})`,
    };
}

function buildNativeEnum(
    call: CallExpression,
    enumTypes: ReadonlyMap<string, EnumTypeInfo>,
    diagnostics: DiagnosticCollector,
): string | null {
    const { defaultArg, named } = splitArgs(call);
    if (defaultArg === null || defaultArg.value.kind !== "member-access-expression") {
        diagnostics.pushCode("input-enum-default-not-member", call.span);
        return null;
    }
    const defaultValue = defaultArg.value;
    const enumType = resolveEnumType(defaultValue, enumTypes);
    const selected = resolveEnumMemberValue(defaultValue, enumTypes);
    if (enumType === null || selected === null) {
        diagnostics.pushCode("input-enum-default-not-member", defaultArg.span);
        return null;
    }
    const options = enumType.members.map((member) => JSON.stringify(member.value));
    warnUnmappedEnumArgs(named, diagnostics);
    const optionsOpt = buildEnumOpts(call, named, diagnostics);
    return `${STRING_OPTIONS_ENUM_BUILDER}(${JSON.stringify(selected)}, [${options.join(", ")}]${optionsOpt})`;
}

// The typed `input.*` factory a bare `input(defval=<literal>)` maps to, by the
// default literal's kind.
const BARE_TYPED_FACTORY: ReadonlyMap<LiteralKind, string> = new Map([
    ["int", "input.int"],
    ["float", "input.float"],
    ["bool", "input.bool"],
    ["string", "input.string"],
    ["color", "input.color"],
]);

// The typed `input.*` factory + chartlang default source a bare
// `input(defval=<literal>)` maps to, or `null` when the default is not a
// compile-time literal (a `na`-expression, a computed value, or — handled by
// the caller before this — an OHLCV source). A unary `+`/`-` on a numeric
// literal (`input(-1)`) keeps its numeric factory.
type BareTypedDefault = Readonly<{ factory: string; literal: string }>;

function bareTypedDefault(node: ExpressionNode): BareTypedDefault | null {
    const literalNode =
        node.kind === "unary-expression" && node.operator !== "not" ? node.operand : node;
    if (literalNode.kind !== "literal-expression") {
        return null;
    }
    const factory = BARE_TYPED_FACTORY.get(literalNode.literalKind);
    const literal = literalDefault(node);
    if (factory === undefined || literal === null) {
        return null;
    }
    return { factory, literal };
}

// Close a bare-input factory call (`input.source("close"` / `input.int(14`),
// threading any recognised title/range options from the named args.
function appendBareOptions(
    prefix: string,
    named: ReadonlyMap<string, Argument>,
    diagnostics: DiagnosticCollector,
): string {
    const options = buildOptions(named, false, diagnostics, false);
    return options === null ? `${prefix})` : `${prefix}, ${options})`;
}

// Lower a bare generic `input(...)` call. The TARGET is a TRANSFORM decision
// keyed on the resolved `defval` (positional or named `defval=`): an OHLCV /
// synthetic series default → `input.source` (hoisted to `manifest.inputs`, read
// as `inputs.<name>`); a compile-time literal default → the typed
// `input.int/float/bool/string/color` factory by the literal's kind. A missing
// default, `na`, or a computed default has no inferable type → reject with
// `non-literal-input-default`.
function buildBareInput(
    call: CallExpression,
    positionalDefault: Argument | null,
    named: ReadonlyMap<string, Argument>,
    diagnostics: DiagnosticCollector,
): string | null {
    const defaultArg = positionalDefault ?? named.get("defval") ?? null;
    if (defaultArg === null) {
        diagnostics.pushCode("non-literal-input-default", call.span);
        return null;
    }
    // `defval` is consumed as the default — never an option-object field.
    const optionNamed = new Map(named);
    optionNamed.delete("defval");
    const value = defaultArg.value;
    const source = sourceDefault(value);
    if (source !== null) {
        return appendBareOptions(`input.source(${source}`, optionNamed, diagnostics);
    }
    const typed = bareTypedDefault(value);
    if (typed === null) {
        diagnostics.pushCode("non-literal-input-default", call.span);
        return null;
    }
    return appendBareOptions(`${typed.factory}(${typed.literal}`, optionNamed, diagnostics);
}

// Build the chartlang `input.*(...)` source string for one Pine input call,
// or `null` when the call cannot be converted (a diagnostic is pushed).
// `primitive` is the resolved Pine `input.*` key (`"input.text_area"`).
function buildInputCode(
    call: CallExpression,
    primitive: string,
    enumTypes: ReadonlyMap<string, EnumTypeInfo>,
    diagnostics: DiagnosticCollector,
): string | null {
    if (primitive === "input.enum") {
        return buildNativeEnum(call, enumTypes, diagnostics);
    }
    const mapping = inputLookup(primitive);
    if (mapping === null) {
        diagnostics.pushCode("unknown-input-primitive", call.span);
        return null;
    }
    const { defaultArg, named } = splitArgs(call);
    // The bare generic `input(...)` form picks `input.source` (series defval) vs
    // a typed factory (literal defval) by inspecting the resolved default.
    if (primitive === "input") {
        return buildBareInput(call, defaultArg, named, diagnostics);
    }
    // A Pine `input.string/int/float(..., options=[…])` is a dropdown: a uniform
    // string list → `input.enum`, a uniform numeric list → `input.enum<number>`;
    // a mixed/non-literal list falls back to the plain factory (options dropped);
    // a cross-type / empty list defers to the generic path.
    let skipOptionsArg = false;
    const optionsConfig = OPTIONS_DROPDOWN_CONFIG.get(primitive);
    if (optionsConfig !== undefined) {
        const dropdown = resolveOptionsEnum(call, defaultArg, named, diagnostics, optionsConfig);
        if (dropdown.kind === "enum") {
            return dropdown.code;
        }
        skipOptionsArg = dropdown.kind === "fallback";
    }
    const defaultExpr = resolveDefault(primitive, defaultArg, call.span, diagnostics);
    if (defaultExpr === null) {
        return null;
    }
    const builder = mapping.chartlang;
    const options = buildOptions(
        named,
        primitive === "input.text_area",
        diagnostics,
        skipOptionsArg,
    );
    return options === null
        ? `${builder}(${defaultExpr})`
        : `${builder}(${defaultExpr}, ${options})`;
}

// One promotable inline `input.*` call paired with its resolved Pine key.
type InlineInput = Readonly<{ call: CallExpression; key: string }>;

// Walk an expression subtree collecting every `input.*` call. A named input
// call (the direct value of an assignment/declaration) is registered by the
// caller and EXCLUDED here, so this only surfaces inline (nested) inputs.
function collectInlineInputs(node: ExpressionNode, out: InlineInput[]): void {
    const key = inputCallKey(node);
    if (key !== null && node.kind === "call-expression") {
        out.push({ call: node, key });
    }
    switch (node.kind) {
        case "unary-expression":
            collectInlineInputs(node.operand, out);
            return;
        case "binary-expression":
            collectInlineInputs(node.left, out);
            collectInlineInputs(node.right, out);
            return;
        case "ternary-expression":
            collectInlineInputs(node.condition, out);
            collectInlineInputs(node.consequent, out);
            collectInlineInputs(node.alternate, out);
            return;
        case "call-expression":
            collectInlineInputs(node.callee, out);
            for (const arg of node.args) {
                collectInlineInputs(arg.value, out);
            }
            return;
        case "member-access-expression":
            if (node.head !== null) {
                collectInlineInputs(node.head, out);
            }
            return;
        case "history-access-expression":
            collectInlineInputs(node.receiver, out);
            collectInlineInputs(node.offset, out);
            return;
        case "paren-expression":
            collectInlineInputs(node.expression, out);
            return;
        case "tuple-expression":
        case "array-literal-expression":
            for (const el of node.elements) {
                collectInlineInputs(el, out);
            }
            return;
        case "lambda-expression":
            collectInlineInputs(node.body, out);
            return;
        default:
            return;
    }
}

// State threaded through the statement walk: the scaffold being populated and
// the diagnostic sink. Synthesised inline-input names come from the scaffold's
// shared allocator (readable + collision-free), so no per-walk counter.
type WalkState = {
    scaffold: ScriptScaffold;
    diagnostics: DiagnosticCollector;
    enumTypes: ReadonlyMap<string, EnumTypeInfo>;
    // Inline `input.*(...)` call `spanKey` → its promoted top-level input name,
    // so the emitter can rewrite the use site to the `inputs.<name>` read.
    // Keyed by span (not node identity — `udfInline` clones nodes downstream).
    promotedInline: Map<string, string>;
};

// Register a named input declaration (`len = input.int(...)`) — its bound
// name keys the chartlang descriptor.
function registerNamed(name: string, call: CallExpression, key: string, state: WalkState): void {
    const code = buildInputCode(call, key, state.enumTypes, state.diagnostics);
    if (code === null) {
        return;
    }
    const input: InputDeclarationIR = { name, code };
    appendInput(state.scaffold, input);
}

// Register a promoted inline input (`ta.ema(close, input.int(20))`) with a
// synthesised name and an `inline-input-promoted` info diagnostic.
function registerInline(inline: InlineInput, state: WalkState): void {
    const code = buildInputCode(inline.call, inline.key, state.enumTypes, state.diagnostics);
    if (code === null) {
        return;
    }
    const name = state.scaffold.names.allocate("inlineInput");
    state.diagnostics.pushCode("inline-input-promoted", inline.call.span);
    const input: InputDeclarationIR = { name, code };
    appendInput(state.scaffold, input);
    // Record the call node → promoted name so the emitter rewrites the use site
    // to `inputs.<name>` (an un-rewritten inline `input.*(...)` is invalid in
    // `compute`).
    state.promotedInline.set(spanKey(inline.call.span), name);
}

// Promote every inline input nested in an expression (used for value
// positions that are NOT a direct named-input declaration).
function walkInlineExpression(node: ExpressionNode, state: WalkState): void {
    const inline: InlineInput[] = [];
    collectInlineInputs(node, inline);
    for (const item of inline) {
        registerInline(item, state);
    }
}

// Register the value of a named declaration: a direct `input.*` call becomes
// a named input keyed by `name`; otherwise any nested inline inputs promote.
function walkNamedValue(name: string, value: ExpressionNode, state: WalkState): void {
    const key = inputCallKey(value);
    if (key !== null && value.kind === "call-expression") {
        registerNamed(name, value, key, state);
        return;
    }
    walkInlineExpression(value, state);
}

function walkStatement(statement: Statement, state: WalkState): void {
    switch (statement.kind) {
        case "variable-declaration":
            walkNamedValue(statement.name, statement.initializer, state);
            return;
        case "assignment":
            walkNamedValue(statement.name, statement.value, state);
            return;
        case "expression-statement":
            walkInlineExpression(statement.expression, state);
            return;
        case "if-statement":
            walkInlineExpression(statement.condition, state);
            walkStatements(statement.thenBody.body, state);
            for (const arm of statement.elseIfClauses) {
                walkInlineExpression(arm.condition, state);
                walkStatements(arm.body.body, state);
            }
            if (statement.elseBody !== null) {
                walkStatements(statement.elseBody.body, state);
            }
            return;
        case "for-statement":
            walkInlineExpression(statement.from, state);
            walkInlineExpression(statement.to, state);
            if (statement.step !== null) {
                walkInlineExpression(statement.step, state);
            }
            walkStatements(statement.body.body, state);
            return;
        case "switch-statement":
            if (statement.subject !== null) {
                walkInlineExpression(statement.subject, state);
            }
            for (const arm of statement.cases) {
                if (arm.test !== null) {
                    walkInlineExpression(arm.test, state);
                }
                walkStatements(arm.body, state);
            }
            return;
        case "block-statement":
            walkStatements(statement.body, state);
            return;
        case "return-statement":
            if (statement.value !== null) {
                walkInlineExpression(statement.value, state);
            }
            return;
        case "enum-declaration":
            return;
        default:
            return;
    }
}

function walkStatements(statements: readonly Statement[], state: WalkState): void {
    for (const statement of statements) {
        walkStatement(statement, state);
    }
}

/**
 * Lower every Pine `input.*` declaration in the analysed script into a
 * chartlang `input.*(...)` source string appended to the
 * {@link ScriptScaffold}'s `inputs` array (via {@link appendInput}). A named
 * declaration (`len = input.int(20)`) keys its descriptor by the bound name;
 * an inline call (`ta.ema(close, input.int(20))`) is promoted to a
 * synthesised `inlineInput` name (e.g. `inlineInput`/`inlineInput2`) with an `inline-input-promoted` info
 * diagnostic. A `string`/`numeric` `options=[…]` dropdown bridges onto
 * `input.enum`; native Pine `input.enum(EnumType.member, ...)` lowers to a
 * string-backed chartlang `input.enum`; a bare generic `input(...)` lowers to `input.source` (series
 * default) or the typed `input.int/float/bool/string` (literal default).
 * Unconvertible inputs (a non-member native enum default, a computed
 * `input.source` default, a non-literal default) push an error and are skipped. The
 * function mutates the scaffold (appending to `scaffold.inputs`) and RETURNS a
 * map from each promoted inline `input.*(...)` call node to its synthesised
 * input name, so the emitter rewrites the inline use site to its
 * `inputs.<name>` read (an un-rewritten inline `input.*(...)` is invalid inside
 * `compute`). A named declaration's identifier is rewritten via the scaffold's
 * input-name set as before.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { lex } from "../lexer/index.js";
 *     import { parseStatements } from "../parser/index.js";
 *     import { analyze } from "../semantic/index.js";
 *     import { DiagnosticCollector } from "./diagnosticCollector.js";
 *     import { transformDeclaration } from "./declaration.js";
 *     const src = '//@version=6\nindicator("X")\nlen = input.int(20)\nplot(close)\n';
 *     const analysis = analyze(parseStatements(lex(src).tokens).script);
 *     const decl = analysis.script.declaration;
 *     if (decl !== null && decl.kind === "indicator-declaration") {
 *         const diagnostics = new DiagnosticCollector();
 *         const scaffold = transformDeclaration(decl, analysis, diagnostics);
 *         transformInputs(analysis, scaffold, diagnostics);
 *         void scaffold.inputs; // [{ name: "len", code: "input.int(20)" }]
 *     }
 */
export function transformInputs(
    analysis: SemanticResult,
    scaffold: ScriptScaffold,
    diagnostics: DiagnosticCollector,
): ReadonlyMap<string, string> {
    const state: WalkState = {
        scaffold,
        diagnostics,
        enumTypes: analysis.enumTypes,
        promotedInline: new Map(),
    };
    walkStatements(analysis.script.body, state);
    return state.promotedInline;
}
