// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Time } from "../types.js";

const sentinel = (name: string): never => {
    throw new Error(`${name} called outside an active script step`);
};

/**
 * Calendar accessors over a `Time` epoch (UTC ms since epoch). Each accessor
 * is a pure function of an explicit `Time` plus an optional IANA timezone
 * string; the default `tz` is the active mount's `syminfo.timezone`, falling
 * back to `"UTC"` when that is empty. Authors never touch `Date`/`Intl` (both
 * are banned on the script path) — the runtime owns the epoch math.
 *
 * v1 resolves UTC and fixed-offset zones only; a DST zone resolves to UTC plus
 * a one-time diagnostic (see the determinism note in the docs).
 *
 * The runtime replaces this compile-time callable hole with a real namespace
 * through `ComputeContext.time`.
 *
 * @since 1.5
 * @stable
 * @example
 *     const ns: typeof time = time;
 *     void ns;
 */
export const time = Object.freeze({
    /**
     * Calendar year of `t` (e.g. `2024`).
     *
     * @since 1.5
     * @stable
     * @example
     *     const fn: typeof time.year = time.year;
     *     void fn;
     */
    year(_t: Time, _tz?: string): number {
        return sentinel("time.year");
    },

    /**
     * Calendar month of `t`, `1..12`.
     *
     * @since 1.5
     * @stable
     * @example
     *     const fn: typeof time.month = time.month;
     *     void fn;
     */
    month(_t: Time, _tz?: string): number {
        return sentinel("time.month");
    },

    /**
     * Day of the month of `t`, `1..31`.
     *
     * @since 1.5
     * @stable
     * @example
     *     const fn: typeof time.dayofmonth = time.dayofmonth;
     *     void fn;
     */
    dayofmonth(_t: Time, _tz?: string): number {
        return sentinel("time.dayofmonth");
    },

    /**
     * Day of the week of `t`, following Pine's convention `1=Sunday .. 7=Saturday`
     * (note: NOT the ISO `1=Monday` convention).
     *
     * @since 1.5
     * @stable
     * @example
     *     const fn: typeof time.dayofweek = time.dayofweek;
     *     void fn;
     */
    dayofweek(_t: Time, _tz?: string): number {
        return sentinel("time.dayofweek");
    },

    /**
     * Hour-of-day of `t`, `0..23`.
     *
     * @since 1.5
     * @stable
     * @example
     *     const fn: typeof time.hour = time.hour;
     *     void fn;
     */
    hour(_t: Time, _tz?: string): number {
        return sentinel("time.hour");
    },

    /**
     * Minute-of-hour of `t`, `0..59`.
     *
     * @since 1.5
     * @stable
     * @example
     *     const fn: typeof time.minute = time.minute;
     *     void fn;
     */
    minute(_t: Time, _tz?: string): number {
        return sentinel("time.minute");
    },

    /**
     * Second-of-minute of `t`, `0..59`.
     *
     * @since 1.5
     * @stable
     * @example
     *     const fn: typeof time.second = time.second;
     *     void fn;
     */
    second(_t: Time, _tz?: string): number {
        return sentinel("time.second");
    },

    /**
     * Build a `Time` (UTC ms epoch) from calendar fields. `month` is `1..12`
     * and `day` is `1..31`; `hour`/`minute`/`second` default to `0`. The
     * fields are interpreted in `tz` (default `syminfo.timezone`, fallback
     * `"UTC"`).
     *
     * @since 1.5
     * @stable
     * @example
     *     const fn: typeof time.timestamp = time.timestamp;
     *     void fn;
     */
    timestamp(
        _year: number,
        _month: number,
        _day: number,
        _hour?: number,
        _minute?: number,
        _second?: number,
        _tz?: string,
    ): Time {
        return sentinel("time.timestamp");
    },

    /**
     * Close timestamp of the bar that starts at `t` — Pine's no-arg
     * `time_close()`. Equals `t + interval`, where the interval is the active
     * bar's `timeframe.inSeconds` the runtime reads internally (so this mirrors
     * Pine's "current bar's interval" without an explicit interval argument).
     * `tz` is accepted for surface symmetry with the other `time.*` accessors.
     *
     * @since 1.5
     * @stable
     * @example
     *     const fn: typeof time.timeClose = time.timeClose;
     *     void fn;
     */
    timeClose(_t: Time, _tz?: string): Time {
        return sentinel("time.timeClose");
    },
});

/**
 * Static type of the `time` namespace. Runtime implementations satisfy this
 * shape structurally when installed on `ComputeContext.time`.
 *
 * @since 1.5
 * @stable
 * @example
 *     const ns: TimeNamespace = time;
 *     void ns;
 */
export type TimeNamespace = typeof time;
