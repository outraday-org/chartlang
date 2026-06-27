// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CallExpression, ExpressionNode } from "../ast/index.js";
import { ENUM_VALUE_MAP } from "../mapping/index.js";
import { positionalArgs } from "./callArgs.js";
import type { DiagnosticCollector } from "./diagnosticCollector.js";
import type { EmitContext } from "./emitContext.js";
import { emitWithContext } from "./emitContext.js";

/**
 * Whether a call invokes the bare `alert(...)` builtin (a stateful primitive
 * fired imperatively inside `compute`, same shape in Pine and chartlang). Lets
 * the caller route it to {@link emitAlertCall} before the generic emitter,
 * which would otherwise leak the Pine frequency argument verbatim.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { isAlertCall } from "./alertCall.js";
 *     const call = {
 *         kind: "call-expression",
 *         callee: {
 *             kind: "identifier-expression",
 *             name: "alert",
 *             span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 6 },
 *         },
 *         args: [],
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 8 },
 *     } as const;
 *     isAlertCall(call); // true
 */
export function isAlertCall(call: CallExpression): boolean {
    return call.callee.kind === "identifier-expression" && call.callee.name === "alert";
}

// Whether an argument is a bare-rooted `alert.freq_*` frequency enum. Recognised
// via `ENUM_VALUE_MAP` membership (the `linefill.new` REJECT-but-recognised
// precedent — the freq rows map to `null`, so `enumLookup` would collapse them
// to "no target"), never a private set, so the mapping table stays the single
// vocabulary the converter consults.
function isAlertFrequencyEnum(node: ExpressionNode): boolean {
    return (
        node.kind === "member-access-expression" &&
        node.head === null &&
        node.chain.length === 2 &&
        node.chain[0] === "alert" &&
        ENUM_VALUE_MAP.has(node.chain.join("."))
    );
}

/**
 * Lower a Pine `alert(message, freq?)` call into chartlang `alert(<message>);`.
 * The first positional argument (the message) emits through the ordinary
 * expression emitter, preserving string concatenation. The optional second
 * positional argument — Pine's `alert.freq_*` firing frequency — is CONSUMED
 * (dropped) with an `alert-frequency-not-mapped` info, because chartlang's
 * `AlertOpts` has no frequency contract to honor. The enclosing `if` (which the
 * caller emits) is preserved, NOT hoisted into the call. Returns `null` for a
 * non-alert call or an `alert()` with no positional message (the caller falls
 * back to the generic emitter).
 *
 * @since 0.1
 * @stable
 * @example
 *     import { lex } from "../lexer/index.js";
 *     import { parseStatements } from "../parser/index.js";
 *     import type { EmitContext } from "./emitContext.js";
 *     import { DiagnosticCollector } from "./diagnosticCollector.js";
 *     import { emitAlertCall } from "./alertCall.js";
 *     const src = '//@version=6\nindicator("X")\nalert("hi", alert.freq_all)\n';
 *     const ctx: EmitContext = {
 *         annotations: new Map(),
 *         inputNames: new Set(),
 *         localNames: new Set(),
 *         stateSlots: new Map(),
 *     };
 *     const stmt = parseStatements(lex(src).tokens).script.body[0];
 *     if (stmt?.kind === "expression-statement" && stmt.expression.kind === "call-expression") {
 *         emitAlertCall(stmt.expression, ctx, new DiagnosticCollector());
 *         // 'alert("hi");'  + one `alert-frequency-not-mapped` info
 *     }
 */
export function emitAlertCall(
    call: CallExpression,
    ctx: EmitContext,
    diagnostics: DiagnosticCollector,
): string | null {
    if (!isAlertCall(call)) {
        return null;
    }
    const positional = positionalArgs(call.args);
    const messageArg = positional[0];
    if (messageArg === undefined) {
        return null;
    }
    const freqArg = positional[1];
    if (freqArg !== undefined && isAlertFrequencyEnum(freqArg.value)) {
        diagnostics.pushCode("alert-frequency-not-mapped", call.span);
    }
    return `alert(${emitWithContext(messageArg.value, ctx)});`;
}
