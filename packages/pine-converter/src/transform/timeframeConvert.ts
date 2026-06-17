// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Pine timeframe string → chartlang interval string. Pine encodes a
// timeframe as a bare number of minutes (`"60"`), a seconds suffix
// (`"15S"`), or a single-letter period (`"D"`/`"W"`/`"M"`); chartlang uses
// an explicit unit suffix (`"1h"`/`"1d"`/`"1w"`/`"1M"`). Source:
// https://www.tradingview.com/pine-script-docs/concepts/timeframes/
const PINE_TO_INTERVAL: ReadonlyMap<string, string> = new Map([
    ["1S", "1s"],
    ["15S", "15s"],
    ["1", "1m"],
    ["5", "5m"],
    ["60", "1h"],
    ["240", "4h"],
    ["D", "1d"],
    ["1D", "1d"],
    ["W", "1w"],
    ["1W", "1w"],
    ["M", "1M"],
    ["1M", "1M"],
]);

// chartlang interval → canonical Pine timeframe. The reverse of
// {@link PINE_TO_INTERVAL}, collapsing the `"D"`/`"1D"` and `"W"`/`"1W"`
// aliases onto the single-letter Pine canonical form.
const INTERVAL_TO_PINE: ReadonlyMap<string, string> = new Map([
    ["1s", "1S"],
    ["15s", "15S"],
    ["1m", "1"],
    ["5m", "5"],
    ["1h", "60"],
    ["4h", "240"],
    ["1d", "D"],
    ["1w", "W"],
    ["1M", "M"],
]);

/**
 * Convert a Pine timeframe string (`"60"`, `"15S"`, `"D"`) to its chartlang
 * interval string (`"1h"`, `"15s"`, `"1d"`). Returns `null` for a timeframe
 * outside the v1 conversion table so the caller can raise a diagnostic
 * rather than emit a wrong interval. Reused by Task 15's MTF
 * `request.security` partial support.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { pineTimeframeToInterval } from "./timeframeConvert.js";
 *     pineTimeframeToInterval("60"); // "1h"
 *     pineTimeframeToInterval("999"); // null
 */
export function pineTimeframeToInterval(pine: string): string | null {
    return PINE_TO_INTERVAL.get(pine) ?? null;
}

/**
 * Convert a chartlang interval string (`"1h"`, `"15s"`, `"1d"`) back to its
 * canonical Pine timeframe string (`"60"`, `"15S"`, `"D"`). Returns `null`
 * for an interval outside the v1 conversion table. The inverse of
 * {@link pineTimeframeToInterval} over the canonical (alias-collapsed) Pine
 * forms.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { intervalToPineTimeframe } from "./timeframeConvert.js";
 *     intervalToPineTimeframe("1h"); // "60"
 *     intervalToPineTimeframe("3y"); // null
 */
export function intervalToPineTimeframe(interval: string): string | null {
    return INTERVAL_TO_PINE.get(interval) ?? null;
}
