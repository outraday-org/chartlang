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
 * Lower a Pine `str.*` call into chartlang. Supports the v1 subset
 * (`str.tostring`, `str.format`, `str.length`, `str.contains`, `str.upper`,
 * `str.lower`); a `str.tostring(x, "#.##")` precision mask becomes
 * `x.toFixed(n)` and a `str.format` template synthesises a template literal
 * where the placeholders are bare `{n}` slots. Returns `null` when the call
 * is not a `str.*` member at all; otherwise a {@link StrResult}.
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
