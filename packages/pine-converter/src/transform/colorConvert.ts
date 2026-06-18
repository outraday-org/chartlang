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

// A literal non-negative integer (`80` or `+80`), or `null`.
function literalTransp(node: ExpressionNode): number | null {
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
 * Lower a Pine colour expression to a chartlang colour *source string*. A
 * `color.new(base, transp)` whose `base` is a compile-time-known `#RRGGBB`
 * (a `color.*` enum or a `#RRGGBB` literal) and whose `transp` is a literal
 * int folds to a single quoted `#RRGGBBAA` string via
 * {@link transpToAlphaHex}; a bare `color.*` enum lowers through
 * `enumLookup`; everything else (a runtime colour, a non-literal transp)
 * falls back to {@link emitExpr}. Shared by the polyline / linefill / table
 * transforms.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { convertColor } from "./colorConvert.js";
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
 *     convertColor(node, new Map()); // '"#787B8633"'
 */
export function convertColor(node: ExpressionNode, annotations: AnnotationLookup): string {
    if (node.kind === "call-expression" && dottedCallee(node) === "color.new") {
        const folded = foldColorNew(node);
        if (folded !== null) {
            return folded;
        }
    }
    const enumHex = baseHex(node);
    if (enumHex !== null) {
        return JSON.stringify(enumHex);
    }
    return emitExpr(node, annotations);
}

// Fold a `color.new(base, transp)` into a quoted `#RRGGBBAA` literal, or
// `null` when the base/transp are not both compile-time-known.
function foldColorNew(call: CallExpression): string | null {
    const baseArg = call.args[0];
    const transpArg = call.args[1];
    if (baseArg === undefined || transpArg === undefined) {
        return null;
    }
    const base = baseHex(baseArg.value);
    const transp = literalTransp(transpArg.value);
    if (base === null || transp === null) {
        return null;
    }
    return JSON.stringify(`${base}${transpToAlphaHex(transp)}`);
}
