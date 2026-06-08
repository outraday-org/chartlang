// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Price, Series, Time, Volume } from "../types";

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
 * Secondary-stream bar returned by {@link request.security}. Each field is a
 * `Series<...>` backed by the runtime's secondary-stream ring buffer, or by
 * the all-NaN fallback when `Capabilities.multiTimeframe` is `false`.
 *
 * This is intentionally a series-shaped view rather than the scalar
 * {@link Bar} shape so scripts can read historical secondary bars, such as
 * `daily.close[5]`, once the alignment kernel lands.
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

const sentinel = (name: string): never => {
    throw new Error(`${name} called outside an active script step`);
};

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
export const request = Object.freeze({
    /**
     * Read a secondary candle stream at a script-author-fixed interval.
     *
     * @since 0.4
     * @stable
     * @example
     *     const fn: typeof request.security = request.security;
     *     void fn;
     */
    security(_opts: RequestSecurityOpts): SecurityBar {
        return sentinel("request.security");
    },
});

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
