// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Timeframe-derived helpers. Runtime implementations derive the booleans from
 * `bar.interval` and the active adapter's `IntervalDescriptor.group`.
 *
 * Canonical groups are `"second"`, `"minute"`, `"hour"`, `"daily"`,
 * `"weekly"`, `"monthly"`, `"quarterly"`, and `"yearly"`. Custom groups do
 * not trigger helper booleans.
 *
 * @since 0.4
 * @stable
 * @example
 *     const view: TimeframeView = timeframe;
 *     void view;
 */
export type TimeframeView = {
    /** Same as `bar.interval`. */
    readonly period: string;
    /** True iff `IntervalDescriptor.group` is `"second"`, `"minute"`, or `"hour"`. */
    readonly isintraday: boolean;
    /** True iff `IntervalDescriptor.group` is `"daily"`. */
    readonly isdaily: boolean;
    /** True iff `IntervalDescriptor.group` is `"weekly"`. */
    readonly isweekly: boolean;
    /** True iff `IntervalDescriptor.group` is `"monthly"` or longer. */
    readonly ismonthly: boolean;
    /** Approximate seconds per bar at this interval; `NaN` if unknown. */
    readonly inSeconds: number;
};

/**
 * Module-scope `timeframe` fallback. Outside a script step, the period is
 * empty, every helper boolean is `false`, and `inSeconds` is `NaN`.
 *
 * @since 0.4
 * @stable
 * @example
 *     import { timeframe } from "@invinite-org/chartlang-core";
 *     void timeframe;
 */
export const timeframe: TimeframeView = Object.freeze({
    period: "",
    isintraday: false,
    isdaily: false,
    isweekly: false,
    ismonthly: false,
    inSeconds: Number.NaN,
});
