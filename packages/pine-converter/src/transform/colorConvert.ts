// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CallExpression, ExpressionNode } from "../ast/index.js";
import { enumLookup } from "../mapping/index.js";
import { dottedCallee } from "./callArgs.js";
import type { AnnotationLookup } from "./exprEmit.js";
import { emitExpr } from "./exprEmit.js";

// The base 6-digit `#RRGGBB` hex a color expression resolves to, or `null`
// when it is not a compile-time-known base color (a bare `color.*` enum or a
// `#RRGGBB` literal).
function baseHex(node: ExpressionNode): string | null {
    if (node.kind === "literal-expression" && node.literalKind === "color") {
        return node.value.length === 7 ? node.value : null;
    }
    if (node.kind === "member-access-expression" && node.head === null) {
        const mapping = enumLookup(node.chain.join("."));
        if (mapping !== null && typeof mapping.chartlang === "string") {
            return mapping.chartlang.length === 7 ? mapping.chartlang : null;
        }
    }
    return null;
}

// A literal non-negative integer (`80` or `+80`), or `null`. Shared by the
// `transp` and the `color.rgb(r, g, b)` component reads (both are bare
// non-negative int literals in Pine).
function literalNonNegInt(node: ExpressionNode): number | null {
    if (node.kind === "literal-expression" && node.literalKind === "int") {
        return Number.parseInt(node.value, 10);
    }
    if (
        node.kind === "unary-expression" &&
        node.operator === "+" &&
        node.operand.kind === "literal-expression" &&
        node.operand.literalKind === "int"
    ) {
        return Number.parseInt(node.operand.value, 10);
    }
    return null;
}

// The two-digit uppercase hex of an RGB component, clamped to `[0, 255]` (the
// same `clampByte` floor `core`'s `color.rgb` applies).
function byteHex(value: number): string {
    const clamped = Math.min(255, Math.max(0, Math.floor(value)));
    return clamped.toString(16).toUpperCase().padStart(2, "0");
}

/**
 * Convert a Pine `transp` (0 = fully opaque … 100 = fully transparent) into
 * the two-digit uppercase CSS alpha hex appended to a `#RRGGBB` colour. The
 * mapping is `alpha = round(255 * (100 - clamp(transp, 0, 100)) / 100)`,
 * rendered as a left-zero-padded two-char hex. `transp=0` → `"FF"`,
 * `transp=100` → `"00"`, `transp=80` → `"33"`.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { transpToAlphaHex } from "./colorConvert.js";
 *     transpToAlphaHex(80); // "33"
 */
export function transpToAlphaHex(transp: number): string {
    const clamped = Math.min(100, Math.max(0, transp));
    const alpha = Math.round((255 * (100 - clamped)) / 100);
    return alpha.toString(16).toUpperCase().padStart(2, "0");
}

/**
 * An emitter for a colour sub-expression — the dynamic `base` / `transp` of a
 * `color.new` / 4-arg `color.rgb`, or the non-colour fallback node.
 * {@link convertColor} passes the annotation-based {@link emitExpr};
 * the input/state-aware plot path passes `emitWithContext`.
 *
 * @since 1.6
 * @stable
 * @example
 *     const emit: ColorEmit = (node) => `/* ${node.kind} *\/`;
 *     void emit;
 */
export type ColorEmit = (node: ExpressionNode) => string;

/**
 * Lower a Pine colour expression to a chartlang colour *source string* with a
 * caller-supplied {@link ColorEmit} for the dynamic sub-expressions / fallback.
 * This is the single shared colour rule across the plot, table, and
 * linefill paths — {@link convertColor} is the annotation-based wrapper.
 *
 * Fold rule (fixed): a `color.new(base, transp)` / `color.rgb(r, g, b, transp)`
 * whose components are all compile-time literals folds to a quoted `#RRGGBBAA`
 * string (the `transp` → alpha via {@link transpToAlphaHex}); a **dynamic**
 * base or transp emits `color.withAlpha(<base>, <alpha>)` with `alpha` in
 * `core`'s 0–1 range (`(100 - clamp(transp, 0, 100)) / 100`). A 3-arg
 * `color.rgb(r, g, b)` with literal RGB components folds to `#RRGGBB`; a
 * dynamic 3-arg `color.rgb` and every other node lower through `emit`.
 *
 * @since 1.6
 * @stable
 * @example
 *     import { convertColorWith } from "./colorConvert.js";
 *     import { emitExpr } from "./exprEmit.js";
 *     const node = {
 *         kind: "call-expression",
 *         callee: {
 *             kind: "member-access-expression",
 *             head: null,
 *             chain: ["color", "new"],
 *             span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
 *         },
 *         args: [
 *             {
 *                 name: null,
 *                 value: {
 *                     kind: "member-access-expression",
 *                     head: null,
 *                     chain: ["color", "gray"],
 *                     span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
 *                 },
 *                 span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
 *             },
 *             {
 *                 name: null,
 *                 value: {
 *                     kind: "literal-expression",
 *                     literalKind: "int",
 *                     value: "80",
 *                     span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
 *                 },
 *                 span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
 *             },
 *         ],
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
 *     } as const;
 *     convertColorWith(node, (n) => emitExpr(n, new Map())); // '"#787B8633"'
 */
export function convertColorWith(node: ExpressionNode, emit: ColorEmit): string {
    if (node.kind === "call-expression") {
        const callee = dottedCallee(node);
        if (callee === "color.new") {
            return convertColorNew(node, emit);
        }
        if (callee === "color.rgb") {
            const rgb = convertColorRgb(node, emit);
            if (rgb !== null) {
                return rgb;
            }
        }
    }
    const enumHex = baseHex(node);
    if (enumHex !== null) {
        return JSON.stringify(enumHex);
    }
    return emit(node);
}

/**
 * Lower a Pine colour expression to a chartlang colour *source string*, with
 * its dynamic sub-expressions / fallback emitted via the annotation-based
 * {@link emitExpr}. The thin wrapper over {@link convertColorWith} the
 * polyline / linefill / box-setter transforms use.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { convertColor } from "./colorConvert.js";
 *     const node = {
 *         kind: "member-access-expression",
 *         head: null,
 *         chain: ["color", "blue"],
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
 *     } as const;
 *     convertColor(node, new Map()); // '"#2196F3"'
 */
export function convertColor(node: ExpressionNode, annotations: AnnotationLookup): string {
    return convertColorWith(node, (sub) => emitExpr(sub, annotations));
}

/**
 * Fold a Pine colour expression that is valid in a compile-time literal
 * context to a quoted chartlang `#RRGGBB` / `#RRGGBBAA` source string. Unlike
 * {@link convertColorWith}, this returns `null` instead of emitting dynamic
 * fallbacks when any component is not literal.
 *
 * @since 0.6
 * @stable
 * @example
 *     import { literalColorDefault } from "./colorConvert.js";
 *     const node = {
 *         kind: "member-access-expression",
 *         head: null,
 *         chain: ["color", "yellow"],
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
 *     } as const;
 *     literalColorDefault(node); // '"#FFEB3B"'
 */
export function literalColorDefault(node: ExpressionNode): string | null {
    const enumHex = baseHex(node);
    if (enumHex !== null) {
        return JSON.stringify(enumHex);
    }
    if (node.kind !== "call-expression") {
        return null;
    }
    const callee = dottedCallee(node);
    if (callee === "color.new") {
        return literalColorNewDefault(node);
    }
    if (callee === "color.rgb") {
        return literalColorRgbDefault(node);
    }
    return null;
}

/**
 * Whether a node is a transparency-carrying colour form — a `color.new(base,
 * transp)` (a `transp` arg present) or a 4-arg `color.rgb(r, g, b, transp)`.
 * The plot / hline / table call sites raise `color-transp-approximated` on it.
 *
 * @since 1.6
 * @stable
 * @example
 *     import { isTranspColorForm } from "./colorConvert.js";
 *     const node = {
 *         kind: "identifier-expression",
 *         name: "x",
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
 *     } as const;
 *     isTranspColorForm(node); // false
 */
export function isTranspColorForm(node: ExpressionNode): boolean {
    if (node.kind !== "call-expression") {
        return false;
    }
    const callee = dottedCallee(node);
    if (callee === "color.new") {
        return node.args[1] !== undefined;
    }
    if (callee === "color.rgb") {
        return node.args[3] !== undefined;
    }
    return false;
}

// Lower a `color.new(base, transp)`: a literal base + literal transp folds to a
// `#RRGGBBAA` hex; a dynamic base or transp emits `color.withAlpha(...)`; a
// missing arg passes through `emit` (a malformed/degenerate call).
function convertColorNew(call: CallExpression, emit: ColorEmit): string {
    const baseArg = call.args[0];
    const transpArg = call.args[1];
    if (baseArg === undefined || transpArg === undefined) {
        return emit(call);
    }
    const base = baseHex(baseArg.value);
    const transp = literalNonNegInt(transpArg.value);
    if (base !== null && transp !== null) {
        return JSON.stringify(`${base}${transpToAlphaHex(transp)}`);
    }
    return `color.withAlpha(${colorBaseSource(baseArg.value, emit)}, ${alphaSource(transpArg.value, emit)})`;
}

// Lower a 3-arg `color.rgb(r, g, b)` or 4-arg `color.rgb(r, g, b, transp)`.
// Literal RGB components fold to a `#RRGGBB` hex; all-literal 4-arg calls fold
// to `#RRGGBBAA`; any dynamic 4-arg component emits `color.withAlpha(...)`.
function convertColorRgb(call: CallExpression, emit: ColorEmit): string | null {
    const rArg = call.args[0];
    const gArg = call.args[1];
    const bArg = call.args[2];
    const transpArg = call.args[3];
    if (rArg === undefined || gArg === undefined || bArg === undefined) {
        return null;
    }
    const r = literalNonNegInt(rArg.value);
    const g = literalNonNegInt(gArg.value);
    const b = literalNonNegInt(bArg.value);
    if (transpArg === undefined) {
        if (r !== null && g !== null && b !== null) {
            return JSON.stringify(`#${byteHex(r)}${byteHex(g)}${byteHex(b)}`);
        }
        return null;
    }
    const transp = literalNonNegInt(transpArg.value);
    if (r !== null && g !== null && b !== null && transp !== null) {
        return JSON.stringify(
            `#${byteHex(r)}${byteHex(g)}${byteHex(b)}${transpToAlphaHex(transp)}`,
        );
    }
    const base = `color.rgb(${emit(rArg.value)}, ${emit(gArg.value)}, ${emit(bArg.value)})`;
    return `color.withAlpha(${base}, ${alphaSource(transpArg.value, emit)})`;
}

function literalColorNewDefault(call: CallExpression): string | null {
    const baseArg = call.args[0];
    const transpArg = call.args[1];
    if (baseArg === undefined || transpArg === undefined) {
        return null;
    }
    const base = baseHex(baseArg.value);
    const transp = literalNonNegInt(transpArg.value);
    return base === null || transp === null
        ? null
        : JSON.stringify(`${base}${transpToAlphaHex(transp)}`);
}

function literalColorRgbDefault(call: CallExpression): string | null {
    const rArg = call.args[0];
    const gArg = call.args[1];
    const bArg = call.args[2];
    if (rArg === undefined || gArg === undefined || bArg === undefined) {
        return null;
    }
    const r = literalNonNegInt(rArg.value);
    const g = literalNonNegInt(gArg.value);
    const b = literalNonNegInt(bArg.value);
    if (r === null || g === null || b === null) {
        return null;
    }
    const transpArg = call.args[3];
    if (transpArg === undefined) {
        return JSON.stringify(`#${byteHex(r)}${byteHex(g)}${byteHex(b)}`);
    }
    const transp = literalNonNegInt(transpArg.value);
    return transp === null
        ? null
        : JSON.stringify(`#${byteHex(r)}${byteHex(g)}${byteHex(b)}${transpToAlphaHex(transp)}`);
}

// The `color.withAlpha` base source: a compile-time-known `#RRGGBB` base folds
// to the quoted hex; a dynamic base lowers through `emit`.
function colorBaseSource(node: ExpressionNode, emit: ColorEmit): string {
    const hex = baseHex(node);
    return hex !== null ? JSON.stringify(hex) : emit(node);
}

// The `color.withAlpha` alpha source in `core`'s 0–1 range: a literal transp
// folds to the numeric fraction `(100 - clamp(transp, 0, 100)) / 100`; a
// dynamic transp emits the equivalent expression (`core`'s `withAlpha` clamps).
function alphaSource(node: ExpressionNode, emit: ColorEmit): string {
    const transp = literalNonNegInt(node);
    if (transp !== null) {
        const clamped = Math.min(100, Math.max(0, transp));
        return String((100 - clamped) / 100);
    }
    return `(100 - ${emit(node)}) / 100`;
}
