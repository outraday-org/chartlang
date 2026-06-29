// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ExpressionNode, Script } from "../ast/index.js";
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
 * A resolved higher-timeframe feed as chartlang **emit-source expressions**:
 * `interval` is the opts `interval` value source (`'"1d"'` for a literal,
 * `'inputs.tf'` for an input-bound timeframe) and `symbol` is the opts `symbol`
 * value source (`'"NASDAQ:AAPL"'` / `'inputs.sym'`) or `null` for the chart's
 * own symbol (`syminfo.tickerid` — the opts omit `symbol`, byte-identical to the
 * single-symbol form). The strings are spliced verbatim by {@link securityOpts}
 * (the "emit verbatim source" convention), so an input-bound axis lowers to the
 * `inputs.<name>` reference the Task-3 compiler resolves through its default.
 *
 * @since 0.1
 * @stable
 * @example
 *     import type { SecurityFeed } from "./securityShape.js";
 *     const feed: SecurityFeed = { symbol: '"NASDAQ:AAPL"', interval: '"1d"' };
 *     void feed;
 */
export type SecurityFeed = Readonly<{ symbol: string | null; interval: string }>;

/**
 * Which input axis an identifier-bound `request.security` feed source resolves
 * to: `"symbol"` for an `input.symbol`-bound name, `"interval"` for an
 * `input.timeframe`-bound name.
 *
 * @since 1.7
 * @stable
 * @example
 *     const axis: SecurityFeedAxis = "symbol";
 *     void axis;
 */
export type SecurityFeedAxis = "symbol" | "interval";

/**
 * The set of Pine input names that can source a `request.security` feed,
 * mapped to the axis they resolve (`input.symbol` → `"symbol"`,
 * `input.timeframe` → `"interval"`). Built once per script by
 * {@link collectSecurityFeedInputs} and threaded into {@link resolveSecurityFeed}
 * so an identifier-bound symbol/timeframe lowers to its `inputs.<name>` ref.
 *
 * @since 1.7
 * @stable
 * @example
 *     import type { SecurityFeedInputs } from "./securityShape.js";
 *     const inputs: SecurityFeedInputs = new Map([["tf", "interval"]]);
 *     void inputs;
 */
export type SecurityFeedInputs = ReadonlyMap<string, SecurityFeedAxis>;

// The feed axis a top-level binding's value declares, or `null` when the value
// is not an `input.symbol` / `input.timeframe` call (Pine has no
// `input.interval` — that is the chartlang TARGET name).
function feedAxisOfValue(value: ExpressionNode): SecurityFeedAxis | null {
    if (
        value.kind !== "call-expression" ||
        value.callee.kind !== "member-access-expression" ||
        value.callee.head !== null ||
        value.callee.chain.length !== 2 ||
        value.callee.chain[0] !== "input"
    ) {
        return null;
    }
    const member = value.callee.chain[1];
    if (member === "symbol") {
        return "symbol";
    }
    if (member === "timeframe") {
        return "interval";
    }
    return null;
}

/**
 * Collect every top-level `name = input.symbol(...)` / `input.timeframe(...)`
 * declaration into a {@link SecurityFeedInputs} map (the input keeps its Pine
 * name as its chartlang `inputs.<name>` key). Both the variable-declaration
 * (`string tf = input.timeframe(...)`) and bare-assignment (`sym =
 * input.symbol(...)`) forms register; any other initializer is ignored. The
 * shared pre-pass the single-source and tuple feed resolvers both consult.
 *
 * @since 1.7
 * @stable
 * @example
 *     import { lex } from "../lexer/index.js";
 *     import { parseStatements } from "../parser/index.js";
 *     import { collectSecurityFeedInputs } from "./securityShape.js";
 *     const src = '//@version=6\nindicator("X")\ntf = input.timeframe("D")\nplot(close)\n';
 *     const script = parseStatements(lex(src).tokens).script;
 *     collectSecurityFeedInputs(script).get("tf"); // "interval"
 */
export function collectSecurityFeedInputs(script: Script): SecurityFeedInputs {
    const sources = new Map<string, SecurityFeedAxis>();
    for (const statement of script.body) {
        if (statement.kind === "variable-declaration") {
            const axis = feedAxisOfValue(statement.initializer);
            if (axis !== null) {
                sources.set(statement.name, axis);
            }
        } else if (statement.kind === "assignment") {
            const axis = feedAxisOfValue(statement.value);
            if (axis !== null) {
                sources.set(statement.name, axis);
            }
        }
    }
    return sources;
}

// The `inputs.<name>` emit source for an identifier bound to a feed input of
// the given axis, or `null` when the node is not such an identifier (a computed
// value, or an input of the wrong axis — an `input.int` used as a symbol). Both
// feed axes are string-valued, so the read carries an `as string` cast:
// `compute`'s `inputs` is typed loosely (`Record<string, unknown>`), so an
// un-cast `inputs.<name>` fails the chartlang `RequestSecurityOpts` typecheck.
// The compiler's feed extractor sees through the cast to the `inputs.<name>`
// access (resolving the default), so the cast is transparent to feed analysis.
function inputFeedSource(
    node: ExpressionNode,
    inputs: SecurityFeedInputs,
    axis: SecurityFeedAxis,
): string | null {
    if (node.kind !== "identifier-expression" || inputs.get(node.name) !== axis) {
        return null;
    }
    return `inputs.${node.name} as string`;
}

// The chartlang opts `symbol` value source for a `request.security` symbol arg:
// `null` for the chart's own symbol (`syminfo.tickerid`, omitted), a quoted
// literal for a string symbol, an `inputs.<name>` ref for an `input.symbol`-bound
// identifier, or `undefined` for any other (un-mappable) shape.
function resolveSymbolSource(
    symbol: ExpressionNode,
    inputs: SecurityFeedInputs,
): string | null | undefined {
    if (isTickerId(symbol)) {
        return null;
    }
    const literal = stringLiteralValue(symbol);
    if (literal !== null) {
        return JSON.stringify(literal);
    }
    return inputFeedSource(symbol, inputs, "symbol") ?? undefined;
}

// The chartlang opts `interval` value source for a `request.security` timeframe
// arg: a quoted converted-interval literal, the empty `'""'` chart timeframe
// (Pine's empty `""` tf), an `inputs.<name>` ref for an `input.timeframe`-bound
// identifier, or `null` for any other (un-mappable) shape or out-of-table tf.
function resolveIntervalSource(
    timeframe: ExpressionNode,
    inputs: SecurityFeedInputs,
): string | null {
    const raw = stringLiteralValue(timeframe);
    if (raw !== null) {
        if (raw === "") {
            return JSON.stringify("");
        }
        const interval = pineTimeframeToInterval(raw);
        return interval === null ? null : JSON.stringify(interval);
    }
    return inputFeedSource(timeframe, inputs, "interval");
}

/**
 * Resolve a `request.security` symbol + timeframe argument pair into a
 * {@link SecurityFeed} of chartlang emit sources, or `null` for any shape
 * chartlang cannot key on (a computed / wrong-axis symbol or timeframe, or a
 * literal timeframe outside the conversion table). Both axes accept a string
 * literal, the chart's own symbol/timeframe (`syminfo.tickerid` / empty `""`),
 * and an identifier bound to an `input.symbol` (symbol) / `input.timeframe`
 * (interval) — emitted as the `inputs.<name>` reference the Task-3 compiler
 * resolves through its default. The caller pushes the diagnostic
 * (`request-security-not-mapped`); this resolver is diagnostic-free so the
 * single-source path and the tuple path share one resolution.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { collectSecurityFeedInputs, resolveSecurityFeed } from "./securityShape.js";
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
 *     resolveSecurityFeed(tickerid, interval, new Map()); // { symbol: null, interval: '"1d"' }
 */
export function resolveSecurityFeed(
    symbol: ExpressionNode,
    timeframe: ExpressionNode,
    inputs: SecurityFeedInputs,
): SecurityFeed | null {
    const symbolSource = resolveSymbolSource(symbol, inputs);
    if (symbolSource === undefined) {
        return null;
    }
    const intervalSource = resolveIntervalSource(timeframe, inputs);
    if (intervalSource === null) {
        return null;
    }
    return { symbol: symbolSource, interval: intervalSource };
}

/**
 * Build the chartlang `request.security` opts object literal from a resolved
 * feed: `{ interval }` for the chart's own symbol (`symbol === null`, omitted),
 * `{ symbol, interval }` for a cross-symbol read. The `symbol` / `interval`
 * arguments are chartlang emit-source expressions (a quoted literal or an
 * `inputs.<name>` ref), spliced verbatim. The single source of the opts format —
 * shared by the single-source `emitRequestSecurity` and the per-element tuple
 * lowering so every read of one feed emits a byte-identical opts literal.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { securityOpts } from "./securityShape.js";
 *     securityOpts(null, '"1d"'); // '{ interval: "1d" }'
 *     securityOpts('"NASDAQ:QQQ"', '"1d"'); // '{ symbol: "NASDAQ:QQQ", interval: "1d" }'
 *     securityOpts("inputs.sym", "inputs.tf"); // '{ symbol: inputs.sym, interval: inputs.tf }'
 */
export function securityOpts(symbol: string | null, interval: string): string {
    return symbol === null
        ? `{ interval: ${interval} }`
        : `{ symbol: ${symbol}, interval: ${interval} }`;
}

/**
 * The chartlang **data** form of a security read: `request.security(<opts>)
 * .<field>.current` — the per-bar SCALAR of the higher-timeframe field. The
 * `SecurityBar` fields are `Series<Price>` (series-only, NOT the number-coercible
 * `PriceSeries` intersection the main `bar` uses), so the read is projected to
 * `.current` exactly as `ta.*` results are (`lowerTaToCurrent`) — without it the
 * value cannot be used in scalar arithmetic (`src - ma` ⇒ TS2362). Used for a
 * bare OHLCV source in both the single-source and tuple paths.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { securityDataRead } from "./securityShape.js";
 *     securityDataRead('{ interval: "1d" }', "high"); // 'request.security({ interval: "1d" }).high.current'
 */
export function securityDataRead(opts: string, field: string): string {
    return `request.security(${opts}).${field}.current`;
}

/**
 * The chartlang **callback** form of a security read: `request.security(<opts>,
 * (bar) => <body>).current` — the per-bar SCALAR of the higher-timeframe
 * expression. `body` is the already-emitted source expression (its OHLCV reads
 * rewritten to `bar.*`); the expression form returns `Series<number>`, so the
 * read is projected to `.current` (mirroring `ta.*`) so it can be used in scalar
 * arithmetic. Used for a `ta.*` / computed source in both paths.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { securityCallbackRead } from "./securityShape.js";
 *     securityCallbackRead('{ interval: "1d" }', "ta.ema(bar.close, 9)");
 *     // 'request.security({ interval: "1d" }, (bar) => ta.ema(bar.close, 9)).current'
 */
export function securityCallbackRead(opts: string, body: string): string {
    return `request.security(${opts}, (bar) => ${body}).current`;
}

/**
 * The BLOCK-bodied chartlang **callback** form of a security read:
 * `request.security(<opts>, (bar) => { <prelude…> return <result>; }).current`.
 * Used when a `ta.*` / computed source contains a stateful user-defined
 * function whose inline expansion produces intermediate `let`/`const` prelude
 * lines (e.g. `cf_atr_perct` → `atr = ta.atr(length)` then `(atr/close)*100`):
 * the prelude MUST live inside the callback so its `ta.*`/`state.*` accumulate
 * on the higher-timeframe clock (the way Pine evaluates the source on the HTF
 * bar), not the chart clock. An empty prelude uses the expression form
 * {@link securityCallbackRead} instead.
 *
 * @since 0.4
 * @stable
 * @example
 *     import { securityCallbackReadBlock } from "./securityShape.js";
 *     securityCallbackReadBlock('{ interval: "1d" }', ["let a = ta.atr(14).current;"], "(a / bar.close) * 100");
 *     // 'request.security({ interval: "1d" }, (bar) => { let a = ta.atr(14).current; return (a / bar.close) * 100; }).current'
 */
export function securityCallbackReadBlock(
    opts: string,
    prelude: readonly string[],
    result: string,
): string {
    const body = [...prelude, `return ${result};`].join(" ");
    return `request.security(${opts}, (bar) => { ${body} }).current`;
}
