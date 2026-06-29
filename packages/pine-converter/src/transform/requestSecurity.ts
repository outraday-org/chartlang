// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CallExpression } from "../ast/index.js";
import type { DiagnosticCollector } from "./diagnosticCollector.js";
import type { EmitContext } from "./emitContext.js";
import { emitWithContext } from "./emitContext.js";
import {
    resolveSecurityFeed,
    securityCallbackRead,
    securityDataRead,
    securityField,
    securityOpts,
} from "./securityShape.js";

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
 * Lower an MTF `request.security(<symbol>, "<timeframe>", <source>)` call. The
 * symbol arg decides the opts: `syminfo.tickerid` reads the chart's own symbol
 * and omits `symbol` (`{ interval }`, byte-identical to the single-symbol
 * form); a **string literal** (`"NASDAQ:AAPL"`) carries the symbol into the
 * opts (`{ symbol, interval }`, chartlang multi-symbol); an identifier bound to
 * an `input.symbol` declaration lowers to its `inputs.<name>` reference (the
 * compiler resolves it through the default). A present (cross-symbol) feed
 * pushes an info `request-security-different-symbol` so downstream tooling still
 * sees the cross-symbol read; any other symbol expression (a computed ticker, a
 * non-input identifier) is un-mappable and pushes `request-security-not-mapped`
 * returning `null`. The timeframe arg resolves the same three ways (literal /
 * empty `""` chart timeframe / `input.timeframe`-bound `inputs.<name>` ref).
 *
 * A bare OHLCV source lowers to the chartlang **data** form
 * `request.security(<opts>).<field>` (a `Series`); a `ta.*` / expression
 * source lowers to the chartlang **callback** form
 * `request.security(<opts>, (bar) => <source>)`, which runs the expression on
 * the higher-timeframe clock the way Pine does (the source's `close`/`hl2`/…
 * already rewrite to `bar.close`/`bar.hl2`/… through the shared field mapper).
 * A `lookahead` named arg pushes `request-security-lookahead-not-supported`; a
 * `gaps` named arg pushes the info `request-security-gaps-dropped` once per
 * script (chartlang feeds are gap-filled by default). An out-of-subset shape
 * (computed timeframe,
 * missing args) pushes `request-security-not-mapped` and returns `null`.
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
    // `gaps = barmerge.gaps_off|gaps_on` has no chartlang analogue — chartlang
    // security feeds are gap-filled by default — so it is dropped with one info
    // per script (consolidated by arg name across every feed), never a hard
    // unmapped-arg error.
    const gaps = call.args.find((arg) => arg.name === "gaps");
    if (gaps !== undefined) {
        diagnostics.pushCodeOnce("request-security-gaps-dropped", "gaps", gaps.span);
    }
    const positional = call.args.filter((arg) => arg.name === null).map((arg) => arg.value);
    const symbol = positional[0];
    const timeframe = positional[1];
    const source = positional[2];
    if (symbol === undefined || timeframe === undefined || source === undefined) {
        diagnostics.pushCode("request-security-not-mapped", call.span);
        return null;
    }
    // Resolve the symbol + timeframe into the opts via the shared resolver:
    // `syminfo.tickerid` → `symbol: null` (omit `symbol`, byte-identical to the
    // single-symbol form); a string literal → the cross-symbol `{ symbol }`; an
    // `input.symbol`/`input.timeframe`-bound identifier → its `inputs.<name>`
    // ref (the Task-3 compiler resolves it through the default); anything else
    // (computed ticker/tf, out-of-table timeframe) → `null`, the un-mappable
    // shape.
    const feed = resolveSecurityFeed(symbol, timeframe, ctx.securityFeedInputs ?? new Map());
    if (feed === null) {
        diagnostics.pushCode("request-security-not-mapped", call.span);
        return null;
    }
    if (feed.symbol !== null) {
        // A mappable cross-symbol read — emit the info so downstream tooling
        // still sees the cross-symbol signal even though it now lowers cleanly.
        diagnostics.pushCode("request-security-different-symbol", call.span);
    }
    const opts = securityOpts(feed.symbol, feed.interval);
    const field = securityField(source);
    // A bare OHLCV field reads the aligned data form; any other source (a
    // `ta.*`/expression) runs on the HTF clock via the callback form. The
    // mapper already lowered its OHLCV reads to `bar.<field>`, so the emitted
    // source is the callback body verbatim.
    return field === null
        ? securityCallbackRead(opts, emitWithContext(source, ctx))
        : securityDataRead(opts, field);
}
