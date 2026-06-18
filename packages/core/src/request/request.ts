// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar, Price, Series, Time, Volume } from "../types.js";

/**
 * Argument to {@link request.security}. The `interval` must be a string
 * literal or an `input.enum` value; the compiler's literal-only pass rejects
 * dynamic expressions with `request-security-interval-not-literal`.
 *
 * @since 0.4
 * @stable
 * @example
 *     const opts: RequestSecurityOpts = { interval: "1D" };
 *     void opts;
 */
export type RequestSecurityOpts = Readonly<{
    readonly interval: string;
}>;

/**
 * Argument to {@link request.lowerTf}. The `interval` must be strictly lower
 * than the script's main interval; invalid orderings are rejected by the
 * compiler's `lower-tf-not-lower` diagnostic when statically known.
 *
 * @since 0.6
 * @stable
 * @example
 *     const opts: RequestLowerTfOpts = { interval: "30s" };
 *     void opts;
 */
export type RequestLowerTfOpts = Readonly<{
    readonly interval: string;
}>;

/**
 * Secondary-stream bar returned by {@link request.security}. Each field is a
 * `Series<...>` aligned from the runtime's secondary-stream ring buffer to
 * the current main stream, or by the all-NaN fallback when
 * `Capabilities.multiTimeframe` is `false`, the interval is unsupported, or
 * the host fails to register the secondary stream.
 *
 * This is intentionally a series-shaped view rather than the scalar
 * {@link Bar} shape so scripts can read historical secondary values aligned
 * to main bars, such as `daily.close[5]`.
 *
 * @since 0.4
 * @stable
 * @example
 *     const close: SecurityBar["close"] = { current: 1, length: 1 };
 *     void close;
 */
export type SecurityBar = Readonly<{
    readonly time: Series<Time>;
    readonly open: Series<Price>;
    readonly high: Series<Price>;
    readonly low: Series<Price>;
    readonly close: Series<Price>;
    readonly volume: Series<Volume>;
    readonly hl2: Series<Price>;
    readonly hlc3: Series<Price>;
    readonly ohlc4: Series<Price>;
    readonly hlcc4: Series<Price>;
    readonly symbol: Series<string>;
    readonly interval: Series<string>;
}>;

/**
 * A higher-timeframe expression callback for {@link RequestNamespace.security}.
 * Receives the HTF {@link SecurityBar} (OHLCV series on the secondary
 * stream's own clock) and returns the value to evaluate per HTF bar.
 * The body may reference only the `bar` parameter, the ambient `ta`
 * namespace, `inputs`, safe `Math.*` globals, and literal constants —
 * capturing any other outer binding is a compile error
 * (`request-security-expr-captures-local`).
 *
 * Returning a `Series<number>` (e.g. `(bar) => ta.ema(bar.close, 20)`)
 * lets `ta.*` accumulate over HTF bars; returning a bare `number`
 * (e.g. `(bar) => bar.close.current * 2`) samples the scalar once per
 * HTF bar. Either way the result aligns no-lookahead to the main timeline.
 *
 * @since 0.7
 * @stable
 * @example
 *     const trend: SecurityExpr = (bar) => bar.close;
 *     void trend;
 */
export type SecurityExpr = (bar: SecurityBar) => Series<number> | number;

const sentinel = (name: string): never => {
    throw new Error(`${name} called outside an active script step`);
};

/**
 * Read a secondary candle stream at a script-author-fixed **higher**
 * interval. Two forms:
 *
 * - **Data**: `request.security({ interval })` → a `SecurityBar`.
 *   Every OHLCV field — plus the derived `hl2` / `hlc3` / `ohlc4` /
 *   `hlcc4` and `symbol` / `interval` — is a `Series<...>` aligned
 *   no-lookahead to the chart's bars, so a script can read prior secondary
 *   values such as `weekly.close[5]`.
 * - **Expression**: `request.security({ interval }, (bar) => …)` →
 *   `Series<number>`. The callback runs **on the higher-timeframe clock**
 *   (once per HTF bar), so `ta.*` inside it accumulate over HTF bars; the
 *   result is aligned no-lookahead down to the main timeline. This is the
 *   only correct way to get a "weekly EMA(20)" — the data form's series is
 *   clocked to the main timeline, so `ta.ema(weekly.close, 20)` would
 *   average 20 *main* bars.
 *
 * The `interval` must be a compile-time literal (a string literal or an
 * `input.enum` value); the compiler walks every call to populate
 * `manifest.requestedIntervals`. When the adapter does not advertise
 * `Capabilities.multiTimeframe`, the series degrades to all-NaN rather than
 * erroring. See the multi-timeframe guide for alignment and interval-format
 * details.
 *
 * @since 0.4
 * @stable
 * @example
 *     // weekly EMA(20) — computed over weekly bars, drawn on the chart
 *     const trend = request.security({ interval: "1W" }, (bar) => ta.ema(bar.close, 20));
 *     plot(trend, { title: "Weekly EMA(20)" });
 * @example
 *     // data form — aligned weekly close
 *     const weekly = request.security({ interval: "1W" });
 *     plot(weekly.close, { title: "Weekly close" });
 */
function security(opts: RequestSecurityOpts): SecurityBar;
function security(opts: RequestSecurityOpts, expr: SecurityExpr): Series<number>;
function security(_opts: RequestSecurityOpts, _expr?: SecurityExpr): SecurityBar | Series<number> {
    return sentinel("request.security");
}

/**
 * Read **lower**-timeframe bars contained by each main-stream bar. The
 * result is a `Series<ReadonlyArray<Bar>>` — for every main bar, the array
 * of finer-grained bars that fall inside it (an empty frozen array for
 * out-of-range or unsupported reads). The requested `interval` must be a
 * compile-time literal and **strictly lower** than the chart interval; an
 * equal-or-higher ordering is rejected at compile time with
 * `lower-tf-not-lower` when statically known. Like `request.security`, it
 * degrades to empty arrays when the adapter lacks
 * `Capabilities.multiTimeframe`. See the multi-timeframe guide for the
 * contained-bar model and interval format.
 *
 * @since 0.6
 * @stable
 * @example
 *     // Each main bar carries the array of intrabar 30-second candles.
 *     const intrabar = request.lowerTf({ interval: "30s" });
 *     const count = intrabar.current.length;
 *     void count;
 */
function lowerTf(_opts: RequestLowerTfOpts): Series<ReadonlyArray<Bar>> {
    return sentinel("request.lowerTf");
}

/**
 * `request.*` namespace for secondary timeframe reads. The compiler walks
 * `request.security(...)` calls to populate `manifest.requestedIntervals`;
 * the runtime replaces this callable hole with a slot-aware implementation
 * through `ComputeContext.request`.
 *
 * @since 0.4
 * @stable
 * @example
 *     const ns: typeof request = request;
 *     void ns;
 */
export const request = Object.freeze({ security, lowerTf });

/**
 * Static type of the `request` namespace. Runtime implementations satisfy
 * this shape structurally when installed on `ComputeContext.request`.
 *
 * @since 0.4
 * @stable
 * @example
 *     const ns: RequestNamespace = request;
 *     void ns;
 */
export type RequestNamespace = typeof request;
