// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { SecurityBar, Series } from "@invinite-org/chartlang-core";

function makeSeries<T>(current: T): Series<T> {
    return Object.freeze({ current, length: 0 }) as Series<T>;
}

/**
 * Build the Phase-4 all-NaN `SecurityBar` fallback.
 *
 * Numeric series expose `Number.NaN` at `.current`; string metadata series
 * expose an empty string. Historical index reads return `undefined` until
 * Phase 5 replaces the stub with ring-buffer-backed secondary streams.
 *
 * @since 0.4
 * @stable
 * @example
 *     const bar = makeNanSecurityBar();
 *     const close = bar.close.current;
 *     void close;
 */
export function makeNanSecurityBar(): SecurityBar {
    const nanNumberSeries = makeSeries(Number.NaN);
    const nanStringSeries = makeSeries("");
    return Object.freeze({
        time: nanNumberSeries,
        open: nanNumberSeries,
        high: nanNumberSeries,
        low: nanNumberSeries,
        close: nanNumberSeries,
        volume: nanNumberSeries,
        hl2: nanNumberSeries,
        hlc3: nanNumberSeries,
        ohlc4: nanNumberSeries,
        hlcc4: nanNumberSeries,
        symbol: nanStringSeries,
        interval: nanStringSeries,
    });
}
