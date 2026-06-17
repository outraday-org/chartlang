// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CallExpression, ExpressionNode } from "../ast/index.js";
import type { DiagnosticCollector } from "./diagnosticCollector.js";

// The `strategy.*` order members this transform lowers to alerts.
const STRATEGY_SIGNALS: ReadonlyMap<string, string> = new Map([
    ["entry", "entry"],
    ["exit", "exit"],
    ["close", "close"],
    ["order", "order"],
]);

// The dotted member name of a bare-rooted `strategy.*` callee, or `null`.
function strategyMember(call: CallExpression): string | null {
    const callee = call.callee;
    if (
        callee.kind === "member-access-expression" &&
        callee.head === null &&
        callee.chain.length === 2 &&
        callee.chain[0] === "strategy"
    ) {
        return callee.chain[1];
    }
    return null;
}

// The raw (unquoted) value of a Pine string literal, or `null` otherwise.
function stringLiteralValue(node: ExpressionNode): string | null {
    return node.kind === "literal-expression" && node.literalKind === "string"
        ? node.value.slice(1, -1)
        : null;
}

/**
 * Whether a call invokes a `strategy.*` order member
 * (`entry`/`exit`/`close`/`order`). Lets the caller route a downgraded
 * `strategy(...)` script's signal calls to {@link emitStrategySignal}.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { isStrategySignalCall } from "./strategySignals.js";
 *     const call = {
 *         kind: "call-expression",
 *         callee: {
 *             kind: "member-access-expression",
 *             head: null,
 *             chain: ["strategy", "entry"],
 *             span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 15 },
 *         },
 *         args: [],
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 17 },
 *     } as const;
 *     isStrategySignalCall(call); // true
 */
export function isStrategySignalCall(call: CallExpression): boolean {
    const member = strategyMember(call);
    return member !== null && STRATEGY_SIGNALS.has(member);
}

/**
 * Lower a `strategy.entry/exit/close/order(...)` call into a chartlang
 * `alert("<id> <member>", { severity: "info" })` and push a
 * `strategy-signal-only` info diagnostic. The first string-literal argument
 * (the order id) seeds the alert message; absent → the member name alone.
 * This is a lossy translation — sizing, price, stop, and limit semantics are
 * not reproduced. Returns `null` for a non-strategy-signal call.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { emitStrategySignal } from "./strategySignals.js";
 *     import { DiagnosticCollector } from "./diagnosticCollector.js";
 *     const call = {
 *         kind: "call-expression",
 *         callee: {
 *             kind: "member-access-expression",
 *             head: null,
 *             chain: ["strategy", "entry"],
 *             span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 15 },
 *         },
 *         args: [
 *             {
 *                 name: null,
 *                 value: {
 *                     kind: "literal-expression",
 *                     literalKind: "string",
 *                     value: '"Long"',
 *                     span: { startLine: 1, startColumn: 16, endLine: 1, endColumn: 22 },
 *                 },
 *                 span: { startLine: 1, startColumn: 16, endLine: 1, endColumn: 22 },
 *             },
 *         ],
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 23 },
 *     } as const;
 *     emitStrategySignal(call, new DiagnosticCollector());
 *     // 'alert("Long entry", { severity: "info" });'
 */
export function emitStrategySignal(
    call: CallExpression,
    diagnostics: DiagnosticCollector,
): string | null {
    const member = strategyMember(call);
    if (member === null || !STRATEGY_SIGNALS.has(member)) {
        return null;
    }
    diagnostics.pushCode("strategy-signal-only", call.span);
    const firstPositional = call.args.find((arg) => arg.name === null);
    const id = firstPositional === undefined ? null : stringLiteralValue(firstPositional.value);
    const message = id === null ? member : `${id} ${member}`;
    return `alert(${JSON.stringify(message)}, { severity: "info" });`;
}
