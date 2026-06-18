// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CallExpression, ExpressionNode } from "../ast/index.js";
import type { DiagnosticCollector } from "./diagnosticCollector.js";
import type { EmitContext } from "./emitContext.js";
import { emitWithContext } from "./emitContext.js";
import { pineTimeframeToInterval } from "./timeframeConvert.js";

// The `SecurityBar` series fields a Pine OHLCV/aggregate source lowers to.
const SECURITY_FIELDS: ReadonlySet<string> = new Set([
    "open",
    "high",
    "low",
    "close",
    "volume",
    "hl2",
    "hlc3",
    "ohlc4",
]);

// Whether a call's callee is the bare-rooted `request.security` member.
function isRequestSecurity(call: CallExpression): boolean {
    const callee = call.callee;
    return (
        callee.kind === "member-access-expression" &&
        callee.head === null &&
        callee.chain.length === 2 &&
        callee.chain[0] === "request" &&
        callee.chain[1] === "security"
    );
}

// Whether a node is the `syminfo.tickerid` built-in (the same-symbol marker).
function isTickerId(node: ExpressionNode): boolean {
    return (
        node.kind === "member-access-expression" &&
        node.head === null &&
        node.chain.length === 2 &&
        node.chain[0] === "syminfo" &&
        node.chain[1] === "tickerid"
    );
}

// The raw (unquoted) value of a Pine string literal, or `null` otherwise.
function stringLiteralValue(node: ExpressionNode): string | null {
    return node.kind === "literal-expression" && node.literalKind === "string"
        ? node.value.slice(1, -1)
        : null;
}

// The `SecurityBar` field name a Pine source identifier maps to, or `null`
// for a non-OHLCV source expression.
function securityField(node: ExpressionNode): string | null {
    return node.kind === "identifier-expression" && SECURITY_FIELDS.has(node.name)
        ? node.name
        : null;
}

/**
 * Whether a call invokes `request.security(...)`. Routes the statement /
 * expression to {@link emitRequestSecurity}.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { isRequestSecurityCall } from "./requestSecurity.js";
 *     const call = {
 *         kind: "call-expression",
 *         callee: {
 *             kind: "member-access-expression",
 *             head: null,
 *             chain: ["request", "security"],
 *             span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 17 },
 *         },
 *         args: [],
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 19 },
 *     } as const;
 *     isRequestSecurityCall(call); // true
 */
export function isRequestSecurityCall(call: CallExpression): boolean {
    return isRequestSecurity(call);
}

/**
 * Lower a v1 single-symbol intraday MTF `request.security(syminfo.tickerid,
 * "<timeframe>", <ohlcv>)` call to chartlang `request.security({ interval:
 * "<interval>" }).<field>` (a `Series`). A different symbol pushes
 * `request-security-different-symbol`; a `lookahead` named arg pushes
 * `request-security-lookahead-not-supported`; a non-OHLCV source field passes
 * through with a note. An out-of-subset shape (non-literal timeframe, missing
 * args) pushes `request-security-not-mapped` and returns `null`.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { emitRequestSecurity } from "./requestSecurity.js";
 *     import { DiagnosticCollector } from "./diagnosticCollector.js";
 *     const ctx = {
 *         annotations: new Map(),
 *         inputNames: new Set<string>(),
 *         localNames: new Set<string>(),
 *         stateSlots: new Map<string, string>(),
 *     };
 *     const member = (chain: string[]) =>
 *         ({
 *             kind: "member-access-expression",
 *             head: null,
 *             chain,
 *             span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
 *         }) as const;
 *     const arg = (value: unknown) =>
 *         ({ name: null, value, span: member(["a"]).span }) as const;
 *     const call = {
 *         kind: "call-expression",
 *         callee: member(["request", "security"]),
 *         args: [
 *             arg(member(["syminfo", "tickerid"])),
 *             arg({ kind: "literal-expression", literalKind: "string", value: '"1D"', span: member(["a"]).span }),
 *             arg({ kind: "identifier-expression", name: "close", span: member(["a"]).span }),
 *         ],
 *         span: member(["a"]).span,
 *     } as const;
 *     emitRequestSecurity(call, ctx, new DiagnosticCollector());
 *     // 'request.security({ interval: "1d" }).close'
 */
export function emitRequestSecurity(
    call: CallExpression,
    ctx: EmitContext,
    diagnostics: DiagnosticCollector,
): string | null {
    if (!isRequestSecurity(call)) {
        return null;
    }
    const lookahead = call.args.find((arg) => arg.name === "lookahead");
    if (lookahead !== undefined) {
        diagnostics.pushCode("request-security-lookahead-not-supported", lookahead.span);
    }
    const positional = call.args.filter((arg) => arg.name === null).map((arg) => arg.value);
    const symbol = positional[0];
    const timeframe = positional[1];
    const source = positional[2];
    if (symbol === undefined || timeframe === undefined || source === undefined) {
        diagnostics.pushCode("request-security-not-mapped", call.span);
        return null;
    }
    if (!isTickerId(symbol)) {
        diagnostics.pushCode("request-security-different-symbol", call.span);
    }
    const raw = stringLiteralValue(timeframe);
    if (raw === null) {
        diagnostics.pushCode("request-security-not-mapped", call.span);
        return null;
    }
    const interval = pineTimeframeToInterval(raw);
    if (interval === null) {
        diagnostics.pushCode("request-security-not-mapped", call.span);
        return null;
    }
    const base = `request.security({ interval: ${JSON.stringify(interval)} })`;
    const field = securityField(source);
    return field === null ? `${base}.${emitWithContext(source, ctx)}` : `${base}.${field}`;
}
