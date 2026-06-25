// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CallExpression, ExpressionNode } from "../ast/index.js";
import { dottedCallee } from "./callArgs.js";
import type { EmitContext } from "./emitContext.js";
import { emitWithContext } from "./emitContext.js";

/**
 * Parse a Pine numeric format string (`"#.##"`, `"0.0"`) into the number of
 * fractional digits it requests, for lowering `str.tostring(x, "#.##")` into
 * `x.toFixed(2)`. Returns `null` when the string is not a simple
 * fixed-precision mask (e.g. `"{0,number,#}"` grouping/locale forms), so the
 * caller can warn and pass the call through unchanged.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { parsePineFormat } from "./strFormat.js";
 *     parsePineFormat("#.##"); // 2
 *     parsePineFormat("0"); // 0
 *     parsePineFormat("#,###"); // null
 */
export function parsePineFormat(format: string): number | null {
    const dot = format.indexOf(".");
    const fraction = dot === -1 ? "" : format.slice(dot + 1);
    const integer = dot === -1 ? format : format.slice(0, dot);
    // Only `#`/`0` mask characters are supported on either side of the dot;
    // a second dot, a grouping comma, or any literal breaks the mask.
    if (!/^[#0]*$/.test(integer) || !/^[#0]*$/.test(fraction)) {
        return null;
    }
    return fraction.length;
}

// The raw (unquoted) value of a Pine string literal, or `null` for any other
// node. `LiteralExpression.value` carries the surrounding quotes verbatim.
function stringLiteralValue(node: ExpressionNode): string | null {
    return node.kind === "literal-expression" && node.literalKind === "string"
        ? node.value.slice(1, -1)
        : null;
}

/**
 * The result of lowering a `str.*` call: `{ kind: "code", source }` for a
 * mapped member, `{ kind: "warn", code }` for one that needs a diagnostic +
 * verbatim passthrough.
 *
 * @since 0.1
 * @stable
 * @example
 *     const r: StrResult = { kind: "code", source: "String(x)" };
 *     void r;
 */
export type StrResult =
    | Readonly<{ kind: "code"; source: string }>
    | Readonly<{ kind: "warn"; code: "str-format-not-mapped" | "str-not-mapped" }>;

/**
 * Lower a Pine `str.*` call into chartlang, covering the full Pine v6
 * `str.*` surface as native JS — the same native-where-native-exists shape
 * `math.*` uses for bare `Math.*` (no `str` import/destructure is added to the
 * generated output). Mapped members:
 * `str.tostring` → `String(x)` / `(x).toFixed(n)` (a `"#.##"` precision mask),
 * `str.format` → a synthesised template literal (bare `{n}` slots),
 * `str.length` → `s.length`, `str.upper`/`str.lower` →
 * `s.toUpperCase()`/`s.toLowerCase()`, `str.contains` → `s.includes(t)`,
 * `str.startswith`/`str.endswith` → `s.startsWith(t)`/`s.endsWith(t)`,
 * `str.pos` → `s.indexOf(t)` (Pine returns `na` when absent, JS `-1`),
 * `str.split` → `s.split(sep)`, `str.substring` →
 * `s.substring(begin[, end])`, `str.trim` → `s.trim()`,
 * `str.repeat` → `s.repeat(n)` (2-arg or empty-string-literal separator),
 * `str.replace_all` → `s.replaceAll(t, r)`, `str.replace` → `s.replace(t, r)`
 * (no occurrence, or a literal-`0` occurrence), and `str.tonumber` →
 * `Number(s)` (`NaN` ≈ Pine `na`). `str.match` and `str.format_time` are
 * intentionally rejected (`str-not-mapped` — regex / host-time, no native
 * one-liner), as are a non-empty-separator `str.repeat` and a non-zero /
 * non-literal-occurrence `str.replace`. Returns `null` when the call is not a
 * `str.*` member at all; otherwise a {@link StrResult}.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { emitStr } from "./strFormat.js";
 *     const ctx = {
 *         annotations: new Map(),
 *         inputNames: new Set<string>(),
 *         localNames: new Set<string>(),
 *         stateSlots: new Map<string, string>(),
 *     };
 *     const call = {
 *         kind: "call-expression",
 *         callee: {
 *             kind: "member-access-expression",
 *             head: null,
 *             chain: ["str", "length"],
 *             span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 11 },
 *         },
 *         args: [
 *             {
 *                 name: null,
 *                 value: {
 *                     kind: "identifier-expression",
 *                     name: "s",
 *                     span: { startLine: 1, startColumn: 12, endLine: 1, endColumn: 13 },
 *                 },
 *                 span: { startLine: 1, startColumn: 12, endLine: 1, endColumn: 13 },
 *             },
 *         ],
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 14 },
 *     } as const;
 *     emitStr(call, ctx); // { kind: "code", source: "s.length" }
 */
export function emitStr(call: CallExpression, ctx: EmitContext): StrResult | null {
    const name = dottedCallee(call);
    if (name === null || !name.startsWith("str.")) {
        return null;
    }
    const args = call.args.map((arg) => arg.value);
    const member = name.slice("str.".length);
    switch (member) {
        case "tostring":
            return emitToString(args, ctx);
        case "format":
            return emitFormat(args, ctx);
        case "length":
            return unary(args, ctx, (s) => `${s}.length`);
        case "upper":
            return unary(args, ctx, (s) => `${s}.toUpperCase()`);
        case "lower":
            return unary(args, ctx, (s) => `${s}.toLowerCase()`);
        case "contains":
            return binary(args, ctx, (a, b) => `${a}.includes(${b})`);
        case "startswith":
            return binary(args, ctx, (s, sub) => `${s}.startsWith(${sub})`);
        case "endswith":
            return binary(args, ctx, (s, sub) => `${s}.endsWith(${sub})`);
        case "pos":
            return binary(args, ctx, (s, sub) => `${s}.indexOf(${sub})`);
        case "split":
            return binary(args, ctx, (s, sep) => `${s}.split(${sep})`);
        case "substring":
            return emitSubstring(args, ctx);
        case "trim":
            return unary(args, ctx, (s) => `${s}.trim()`);
        case "repeat":
            return emitRepeat(args, ctx);
        case "replace_all":
            return ternary(args, ctx, (s, target, repl) => `${s}.replaceAll(${target}, ${repl})`);
        case "replace":
            return emitReplace(args, ctx);
        case "tonumber":
            return unary(args, ctx, (s) => `Number(${s})`);
        // `match` (regex) and `format_time` (host-time) have no native
        // one-liner — they fall through to `default` and reject with
        // `str-not-mapped`. Listed here so the omission is intentional.
        default:
            return { kind: "warn", code: "str-not-mapped" };
    }
}

function unary(
    args: readonly ExpressionNode[],
    ctx: EmitContext,
    build: (a: string) => string,
): StrResult {
    const first = args[0];
    if (first === undefined) {
        return { kind: "warn", code: "str-not-mapped" };
    }
    return { kind: "code", source: build(emitWithContext(first, ctx)) };
}

function binary(
    args: readonly ExpressionNode[],
    ctx: EmitContext,
    build: (a: string, b: string) => string,
): StrResult {
    const first = args[0];
    const second = args[1];
    if (first === undefined || second === undefined) {
        return { kind: "warn", code: "str-not-mapped" };
    }
    return {
        kind: "code",
        source: build(emitWithContext(first, ctx), emitWithContext(second, ctx)),
    };
}

function ternary(
    args: readonly ExpressionNode[],
    ctx: EmitContext,
    build: (a: string, b: string, c: string) => string,
): StrResult {
    const first = args[0];
    const second = args[1];
    const third = args[2];
    if (first === undefined || second === undefined || third === undefined) {
        return { kind: "warn", code: "str-not-mapped" };
    }
    return {
        kind: "code",
        source: build(
            emitWithContext(first, ctx),
            emitWithContext(second, ctx),
            emitWithContext(third, ctx),
        ),
    };
}

// `str.substring(source, begin[, end])` — both bounds are 0-based and `end`
// is exclusive, matching JS exactly. 2 args → `s.substring(begin)`, 3 args →
// `s.substring(begin, end)`, fewer than 2 → `str-not-mapped` (malformed).
function emitSubstring(args: readonly ExpressionNode[], ctx: EmitContext): StrResult {
    const source = args[0];
    const begin = args[1];
    if (source === undefined || begin === undefined) {
        return { kind: "warn", code: "str-not-mapped" };
    }
    const s = emitWithContext(source, ctx);
    const b = emitWithContext(begin, ctx);
    const end = args[2];
    return {
        kind: "code",
        source:
            end === undefined
                ? `${s}.substring(${b})`
                : `${s}.substring(${b}, ${emitWithContext(end, ctx)})`,
    };
}

// `str.repeat(source, repeat[, separator])`. JS has no one-expression
// "repeat with separator", so only the no-separator and empty-string-literal
// (`""`) separator forms map to `s.repeat(n)`; any non-empty / non-literal
// separator rejects (`str-not-mapped`). Fewer than 2 args → `str-not-mapped`.
function emitRepeat(args: readonly ExpressionNode[], ctx: EmitContext): StrResult {
    const source = args[0];
    const count = args[1];
    if (source === undefined || count === undefined) {
        return { kind: "warn", code: "str-not-mapped" };
    }
    const separator = args[2];
    if (separator !== undefined && stringLiteralValue(separator) !== "") {
        return { kind: "warn", code: "str-not-mapped" };
    }
    return {
        kind: "code",
        source: `${emitWithContext(source, ctx)}.repeat(${emitWithContext(count, ctx)})`,
    };
}

// `str.replace(source, target, replacement[, occurrence])`. A JS string-target
// `s.replace(t, r)` replaces the FIRST match — equivalent to Pine occurrence
// `0`. So the no-occurrence and literal-`0` (incl. unary `+0`/`-0`) forms map;
// any non-zero / non-literal occurrence rejects (`str-not-mapped`, no native
// nth-occurrence one-liner). Fewer than 3 args → `str-not-mapped`.
function emitReplace(args: readonly ExpressionNode[], ctx: EmitContext): StrResult {
    const source = args[0];
    const target = args[1];
    const replacement = args[2];
    if (source === undefined || target === undefined || replacement === undefined) {
        return { kind: "warn", code: "str-not-mapped" };
    }
    const occurrence = args[3];
    if (occurrence !== undefined && !literalZero(occurrence)) {
        return { kind: "warn", code: "str-not-mapped" };
    }
    const s = emitWithContext(source, ctx);
    const t = emitWithContext(target, ctx);
    const r = emitWithContext(replacement, ctx);
    return { kind: "code", source: `${s}.replace(${t}, ${r})` };
}

// Whether a node is the literal `0` (`0` / `0.0`), including a unary `+0`/`-0`.
// Mirrors `plotFamily.ts`'s private `isLiteralZero` (literal-number predicates
// are intentionally kept per-file, see pine-converter/CLAUDE.md) but also
// unwraps a unary operand so `str.replace(s, t, r, +0)` reads as occurrence 0.
function literalZero(node: ExpressionNode): boolean {
    const inner = node.kind === "unary-expression" ? node.operand : node;
    return (
        inner.kind === "literal-expression" &&
        (inner.literalKind === "int" || inner.literalKind === "float") &&
        Number(inner.value) === 0
    );
}

function emitToString(args: readonly ExpressionNode[], ctx: EmitContext): StrResult {
    const value = args[0];
    if (value === undefined) {
        return { kind: "warn", code: "str-not-mapped" };
    }
    const valueSource = emitWithContext(value, ctx);
    const formatArg = args[1];
    if (formatArg === undefined) {
        return { kind: "code", source: `String(${valueSource})` };
    }
    const format = stringLiteralValue(formatArg);
    if (format === null) {
        return { kind: "warn", code: "str-format-not-mapped" };
    }
    const precision = parsePineFormat(format);
    if (precision === null) {
        return { kind: "warn", code: "str-format-not-mapped" };
    }
    return { kind: "code", source: `(${valueSource}).toFixed(${precision})` };
}

function emitFormat(args: readonly ExpressionNode[], ctx: EmitContext): StrResult {
    const formatArg = args[0];
    if (formatArg === undefined) {
        return { kind: "warn", code: "str-format-not-mapped" };
    }
    const template = stringLiteralValue(formatArg);
    if (template === null) {
        return { kind: "warn", code: "str-format-not-mapped" };
    }
    const values = args.slice(1).map((node) => emitWithContext(node, ctx));
    const synthesised = synthesizeTemplate(template, values);
    return synthesised === null
        ? { kind: "warn", code: "str-format-not-mapped" }
        : { kind: "code", source: synthesised };
}

// Replace each `{n}` placeholder in a Pine `str.format` template with the
// matching `${value}` interpolation, producing a JS template literal. Any
// `{n,number,…}` styled placeholder (a comma inside the braces) or an
// out-of-range index defeats the synthesis and returns `null`.
function synthesizeTemplate(template: string, values: readonly string[]): string | null {
    let result = "";
    let index = 0;
    while (index < template.length) {
        const char = template[index];
        if (char !== "{") {
            result += char === "`" || char === "$" || char === "\\" ? `\\${char}` : char;
            index += 1;
            continue;
        }
        const close = template.indexOf("}", index);
        if (close === -1) {
            return null;
        }
        const slot = template.slice(index + 1, close);
        if (!/^\d+$/.test(slot)) {
            return null;
        }
        const value = values[Number.parseInt(slot, 10)];
        if (value === undefined) {
            return null;
        }
        result += `\${${value}}`;
        index = close + 1;
    }
    return `\`${result}\``;
}
