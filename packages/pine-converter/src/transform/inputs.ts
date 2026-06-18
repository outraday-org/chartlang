// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CallExpression, ExpressionNode } from "../ast/index.js";
import type { Argument } from "../ast/script.js";
import type { Statement } from "../ast/statements.js";
import type { SourceSpan } from "../index.js";
import { inputLookup } from "../mapping/index.js";
import type { SemanticResult } from "../semantic/index.js";
import type { DiagnosticCollector } from "./diagnosticCollector.js";
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

// The Pine `input.*` member key (`"input.int"`) for a call whose callee is
// a `member-access-expression` `chain: ["input", <kind>]`, or `null` when
// the call is not an `input.*` primitive.
function inputCalleeKey(call: CallExpression): string | null {
    const callee = call.callee;
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

// Build the chartlang options-object source (`{ title: "X", min: 1 }`) from
// the named args, or `null` when no recognised option is present. Unmapped
// named args (`tooltip`/`group`/`inline`/`confirm`/…) raise
// `input-arg-not-mapped` once per occurrence. `multiline` is forced on for a
// `text_area` source.
function buildOptions(
    named: ReadonlyMap<string, Argument>,
    multiline: boolean,
    diagnostics: DiagnosticCollector,
): string | null {
    const parts: string[] = [];
    const titleArg = named.get("title");
    if (titleArg !== undefined) {
        const title = stringLiteralOf(titleArg.value);
        if (title !== null) {
            parts.push(`title: ${title}`);
        } else {
            diagnostics.pushCode("input-arg-not-mapped", titleArg.span);
        }
    }
    for (const [argName, option] of RANGE_ARG_TO_OPTION) {
        const arg = named.get(argName);
        if (arg === undefined) {
            continue;
        }
        const value = literalDefault(arg.value);
        if (value !== null) {
            parts.push(`${option}: ${value}`);
        } else {
            diagnostics.pushCode("input-arg-not-mapped", arg.span);
        }
    }
    for (const [argName, arg] of named) {
        if (argName !== "title" && !RANGE_ARG_TO_OPTION.has(argName)) {
            diagnostics.pushCode("input-arg-not-mapped", arg.span);
        }
    }
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
// timeframe string converted to a chartlang interval literal, or `null` when
// the timeframe is unknown / not a string literal (the caller rejects).
function timeframeDefault(node: ExpressionNode): string | null {
    const raw = stringLiteralOf(node);
    if (raw === null) {
        return null;
    }
    const interval = pineTimeframeToInterval(JSON.parse(raw) as string);
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

// Build the chartlang `input.*(...)` source string for one Pine input call,
// or `null` when the call cannot be converted (a diagnostic is pushed).
// `primitive` is the resolved Pine `input.*` key (`"input.text_area"`).
function buildInputCode(
    call: CallExpression,
    primitive: string,
    diagnostics: DiagnosticCollector,
): string | null {
    if (primitive === "input.enum") {
        diagnostics.pushCode("input-enum-rejected", call.span);
        return null;
    }
    const mapping = inputLookup(primitive);
    if (mapping === null) {
        diagnostics.pushCode("unknown-input-primitive", call.span);
        return null;
    }
    const { defaultArg, named } = splitArgs(call);
    const defaultExpr = resolveDefault(primitive, defaultArg, call.span, diagnostics);
    if (defaultExpr === null) {
        return null;
    }
    const builder = mapping.chartlang;
    const options = buildOptions(named, primitive === "input.text_area", diagnostics);
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
};

// Register a named input declaration (`len = input.int(...)`) — its bound
// name keys the chartlang descriptor.
function registerNamed(name: string, call: CallExpression, key: string, state: WalkState): void {
    const code = buildInputCode(call, key, state.diagnostics);
    if (code === null) {
        return;
    }
    const input: InputDeclarationIR = { name, code };
    appendInput(state.scaffold, input);
}

// Register a promoted inline input (`ta.ema(close, input.int(20))`) with a
// synthesised name and an `inline-input-promoted` info diagnostic.
function registerInline(inline: InlineInput, state: WalkState): void {
    const code = buildInputCode(inline.call, inline.key, state.diagnostics);
    if (code === null) {
        return;
    }
    const name = state.scaffold.names.allocate("inlineInput");
    state.diagnostics.pushCode("inline-input-promoted", inline.call.span);
    const input: InputDeclarationIR = { name, code };
    appendInput(state.scaffold, input);
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
 * diagnostic. Unconvertible inputs (`input.enum`, a computed `input.source`
 * default, a non-literal default) push an error and are skipped. The
 * function mutates the scaffold and is `void` — Task 16 codegen reads
 * `scaffold.inputs` and rewrites the Pine input identifiers to
 * `inputs.<name>` references.
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
): void {
    const state: WalkState = { scaffold, diagnostics };
    walkStatements(analysis.script.body, state);
}
