// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ExpressionNode } from "../ast/index.js";
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

// Whether a node is the `syminfo.tickerid` built-in (the chart's own symbol).
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

/**
 * The `SecurityBar` field name a Pine source identifier maps to (a bare
 * `open`/`high`/`low`/`close`/`volume`/`hl2`/`hlc3`/`ohlc4`), or `null` for any
 * other source expression (a `ta.*` call, an arithmetic node, a non-OHLCV
 * identifier). The single OHLCV-field test shared by the single-source
 * `request.security` data/callback dispatch and the per-element classification
 * of a tuple `request.security` source list — no second copy.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { securityField } from "./securityShape.js";
 *     const high = {
 *         kind: "identifier-expression",
 *         name: "high",
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 5 },
 *     } as const;
 *     securityField(high); // "high"
 */
export function securityField(node: ExpressionNode): string | null {
    return node.kind === "identifier-expression" && SECURITY_FIELDS.has(node.name)
        ? node.name
        : null;
}

/**
 * A resolved higher-timeframe feed: the chartlang `interval` plus the optional
 * `symbol`. `symbol: null` means the chart's own symbol (`syminfo.tickerid`) —
 * the opts omit `symbol` and are byte-identical to the single-symbol form.
 *
 * @since 0.1
 * @stable
 * @example
 *     import type { SecurityFeed } from "./securityShape.js";
 *     const feed: SecurityFeed = { symbol: "NASDAQ:AAPL", interval: "1d" };
 *     void feed;
 */
export type SecurityFeed = Readonly<{ symbol: string | null; interval: string }>;

/**
 * Resolve a `request.security` symbol + timeframe argument pair into a
 * {@link SecurityFeed}, or `null` for any shape chartlang cannot key on (a
 * non-literal / non-`tickerid` symbol, a non-literal timeframe, or a timeframe
 * outside the conversion table). The caller pushes the diagnostic
 * (`request-security-not-mapped`) — this resolver is diagnostic-free so the
 * single-source path and the tuple path share one resolution.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { resolveSecurityFeed } from "./securityShape.js";
 *     const span = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 };
 *     const tickerid = {
 *         kind: "member-access-expression",
 *         head: null,
 *         chain: ["syminfo", "tickerid"],
 *         span,
 *     } as const;
 *     const interval = {
 *         kind: "literal-expression",
 *         literalKind: "string",
 *         value: '"D"',
 *         span,
 *     } as const;
 *     resolveSecurityFeed(tickerid, interval); // { symbol: null, interval: "1d" }
 */
export function resolveSecurityFeed(
    symbol: ExpressionNode,
    timeframe: ExpressionNode,
): SecurityFeed | null {
    const tickerSymbol = isTickerId(symbol) ? null : stringLiteralValue(symbol);
    if (!isTickerId(symbol) && tickerSymbol === null) {
        return null;
    }
    const raw = stringLiteralValue(timeframe);
    if (raw === null) {
        return null;
    }
    const interval = pineTimeframeToInterval(raw);
    if (interval === null) {
        return null;
    }
    return { symbol: tickerSymbol, interval };
}

/**
 * Build the chartlang `request.security` opts object literal from a resolved
 * feed: `{ interval }` for the chart's own symbol (`symbol === null`, omitted),
 * `{ symbol, interval }` for a cross-symbol read. The single source of the opts
 * format — shared by the single-source `emitRequestSecurity` and the per-element
 * tuple lowering so every read of one feed emits a byte-identical opts literal.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { securityOpts } from "./securityShape.js";
 *     securityOpts(null, "1d"); // '{ interval: "1d" }'
 *     securityOpts("NASDAQ:QQQ", "1d"); // '{ symbol: "NASDAQ:QQQ", interval: "1d" }'
 */
export function securityOpts(symbol: string | null, interval: string): string {
    return symbol === null
        ? `{ interval: ${JSON.stringify(interval)} }`
        : `{ symbol: ${JSON.stringify(symbol)}, interval: ${JSON.stringify(interval)} }`;
}

/**
 * The chartlang **data** form of a security read: `request.security(<opts>)
 * .<field>` (a `Series`). Used for a bare OHLCV source in both the single-source
 * and tuple paths.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { securityDataRead } from "./securityShape.js";
 *     securityDataRead('{ interval: "1d" }', "high"); // 'request.security({ interval: "1d" }).high'
 */
export function securityDataRead(opts: string, field: string): string {
    return `request.security(${opts}).${field}`;
}

/**
 * The chartlang **callback** form of a security read: `request.security(<opts>,
 * (bar) => <body>)`, which runs `body` on the higher-timeframe clock (the way
 * Pine does). `body` is the already-emitted source expression (its OHLCV reads
 * rewritten to `bar.*`). Used for a `ta.*` / computed source in both paths.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { securityCallbackRead } from "./securityShape.js";
 *     securityCallbackRead('{ interval: "1d" }', "ta.ema(bar.close, 9)");
 *     // 'request.security({ interval: "1d" }, (bar) => ta.ema(bar.close, 9))'
 */
export function securityCallbackRead(opts: string, body: string): string {
    return `request.security(${opts}, (bar) => ${body})`;
}
