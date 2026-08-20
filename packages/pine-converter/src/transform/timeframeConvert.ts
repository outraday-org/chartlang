// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Pine timeframe string → chartlang interval string. Pine encodes a
// timeframe as a bare number of minutes (`"60"`), a seconds suffix
// (`"15S"`), or a single-letter period (`"D"`/`"W"`/`"M"`); chartlang uses
// an explicit unit suffix (`"1h"`/`"1D"`/`"1W"`/`"1M"`). Source:
// https://www.tradingview.com/pine-script-docs/concepts/timeframes/
//
// TRAP — the SUFFIX CASE is load-bearing and is not a style choice. chartlang's
// interval grammar is `^(\d+)([smHhDWMY]?)$` (`@invinite-org/chartlang-core`,
// `intervalToSeconds`): seconds and minutes are lowercase, day / week / month /
// year are UPPERCASE, and hours accept either. `"1d"` and `"1w"` are therefore
// not chartlang intervals — `intervalToSeconds({ value: "1d" })` throws. This
// table emitted them until 0.9.2.
//
// NOTHING CRASHES, and that is the point: every in-tree caller CATCHES that
// throw, so the damage is silent degradation rather than a failure anyone would
// notice.
//
//  - `runtime/request/security.ts::secondaryIsFinerThanMain` answers
//    `undefined` → "not finer", so a genuinely finer secondary (a `"1d"` read
//    on a `"1W"` main) silently takes the coarser/equal alignment branch, which
//    EXPOSES the in-progress bar instead of the last closed one. A repainting
//    read where the author asked for a non-repainting one.
//  - `compiler/analysis/validateLowerTfIntervals.ts::smallestParseableMain`
//    skips an unparseable descriptor when picking the main interval to compare
//    `request.lowerTf` against.
//  - Any host whose `capabilities.intervals` does not declare the literal
//    refuses the feed by name — which is every default roster.
//
// What is NOT true: that no adapter can serve such a feed. `capabilities`
// carries raw descriptor VALUES, so a host may declare `"1d"` deliberately
// (Invinite's server evaluator does, to also accept its own lowercase enum
// vocabulary) and then serve it. The defect is that the converter emitted a
// token outside the language's own grammar and outside every default roster,
// not that the string is unserveable.
//
// `emitted-intervals-are-parseable.test.ts` checks every value here against
// core's own parser, so a re-lowercasing reddens.
const PINE_TO_INTERVAL: ReadonlyMap<string, string> = new Map([
    ["1S", "1s"],
    ["15S", "15s"],
    ["1", "1m"],
    ["5", "5m"],
    ["60", "1h"],
    ["240", "4h"],
    ["D", "1D"],
    ["1D", "1D"],
    ["W", "1W"],
    ["1W", "1W"],
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
    ["1D", "D"],
    ["1W", "W"],
    ["1M", "M"],
]);

/**
 * Convert a Pine timeframe string (`"60"`, `"15S"`, `"D"`) to its chartlang
 * interval string (`"1h"`, `"15s"`, `"1D"`). Returns `null` for a timeframe
 * outside the v1 conversion table so the caller can raise a diagnostic
 * rather than emit a wrong interval. Reused by Task 15's MTF
 * `request.security` partial support.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { pineTimeframeToInterval } from "./timeframeConvert.js";
 *     pineTimeframeToInterval("60"); // "1h"
 *     pineTimeframeToInterval("D"); // "1D"
 *     pineTimeframeToInterval("999"); // null
 */
export function pineTimeframeToInterval(pine: string): string | null {
    return PINE_TO_INTERVAL.get(pine) ?? null;
}

/**
 * Convert a chartlang interval string (`"1h"`, `"15s"`, `"1D"`) back to its
 * canonical Pine timeframe string (`"60"`, `"15S"`, `"D"`). Returns `null`
 * for an interval outside the v1 conversion table. The inverse of
 * {@link pineTimeframeToInterval} over the canonical (alias-collapsed) Pine
 * forms.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { intervalToPineTimeframe } from "./timeframeConvert.js";
 *     intervalToPineTimeframe("1h"); // "60"
 *     intervalToPineTimeframe("3y"); // null
 */
export function intervalToPineTimeframe(interval: string): string | null {
    return INTERVAL_TO_PINE.get(interval) ?? null;
}
