// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Round `value` to the nearest integer multiple of `step`. A non-positive or
 * non-finite `step` returns `value` unchanged (no-op), matching the
 * price-snapping intent where a missing tick size means "do not snap".
 *
 * @since 1.4
 * @stable
 * @example
 *     math.roundTo(7.34, 0.25); // 7.25
 */
export const roundTo = (value: number, step: number): number =>
    step > 0 && Number.isFinite(step) ? Math.round(value / step) * step : value;

/**
 * Snap `value` to the nearest multiple of `mintick` — the price-snapping twin
 * of {@link roundTo}, named for the `syminfo.mintick` the author threads in.
 * `mintick <= 0` / NaN returns `value` unchanged.
 *
 * @since 1.4
 * @stable
 * @example
 *     math.roundToMintick(101.237, syminfo.mintick); // snap a price to the tick grid
 */
export const roundToMintick = (value: number, mintick: number): number => roundTo(value, mintick);

/**
 * Scalar "not available" predicate — `true` when `value` is NaN or infinite.
 * The plain-number twin of the series-aware `ta.nz` family: chartlang series
 * carry NaN (never Infinity), so the stricter finite check is safe and treats
 * `±Infinity` as not-available too. Pine's `na(x)` is NaN-only.
 *
 * @since 1.4
 * @stable
 * @example
 *     math.na(Number.NaN); // true
 */
export const na = (value: number): boolean => !Number.isFinite(value);

/**
 * Scalar NaN-coalesce — return `value` when finite, else `replacement`
 * (default `0`). The plain-number twin of `ta.nz(series, replacement?)`;
 * mirrors its `?? 0` convention.
 *
 * @since 1.4
 * @stable
 * @example
 *     math.nz(Number.NaN); // 0
 *     math.nz(Number.NaN, -1); // -1
 */
export const nz = (value: number, replacement = 0): number =>
    Number.isFinite(value) ? value : replacement;

/**
 * Replace a non-available `value` with the caller-threaded `lastGood` —
 * `na(value) ? lastGood : value`. The stateful Pine `fixnan` (which threads
 * `lastGood` itself) lives in `ta`/`state`; this is the pure scalar form.
 *
 * @since 1.4
 * @stable
 * @example
 *     math.fixnan(Number.NaN, 5); // 5
 *     math.fixnan(2, 5); // 2
 */
export const fixnan = (value: number, lastGood: number): number =>
    Number.isFinite(value) ? value : lastGood;

/**
 * Sign of `value` (`-1`, `-0`, `0`, or `1`), propagating NaN — unlike
 * `Math.sign(NaN)` which is also NaN but is re-stated here for the Pine-parity
 * surface alongside the chart-aware helpers.
 *
 * @since 1.4
 * @stable
 * @example
 *     math.sign(-3); // -1
 */
export const sign = (value: number): number =>
    Number.isNaN(value) ? Number.NaN : Math.sign(value);

/**
 * Clamp `value` to the inclusive range `[lo, hi]`.
 *
 * @since 1.4
 * @stable
 * @example
 *     math.clamp(12, 0, 10); // 10
 */
export const clamp = (value: number, lo: number, hi: number): number =>
    value < lo ? lo : value > hi ? hi : value;

/**
 * Variadic skip-NaN scalar mean — averages only the finite arguments and
 * returns NaN for an empty or all-non-finite list. A fixed-arity scalar
 * reducer, distinct from the rolling `ta.*` / `state.array(...).avg()` forms.
 * Each argument is coerced with `Number(...)` first, so a number-coercible
 * series view (e.g. a `bar.high`/`bar.low`/`bar.close` field) reduces by its
 * current value instead of being silently skipped as a non-number object.
 *
 * @since 1.4
 * @stable
 * @example
 *     math.avg(2, Number.NaN, 4); // 3
 */
export const avg = (...values: ReadonlyArray<number>): number => {
    let total = 0;
    let count = 0;
    for (const value of values) {
        const n = Number(value);
        if (Number.isFinite(n)) {
            total += n;
            count++;
        }
    }
    return count === 0 ? Number.NaN : total / count;
};

/**
 * Variadic skip-NaN scalar sum — adds only the finite arguments and returns
 * NaN for an empty or all-non-finite list. A fixed-arity scalar reducer,
 * distinct from the rolling `ta.*` / `state.array(...).sum()` forms. Each
 * argument is coerced with `Number(...)` first, so a number-coercible series
 * view (e.g. a `bar.*` field) reduces by its current value instead of being
 * silently skipped as a non-number object.
 *
 * @since 1.4
 * @stable
 * @example
 *     math.sum(2, Number.NaN, 4); // 6
 */
export const sum = (...values: ReadonlyArray<number>): number => {
    let total = 0;
    let count = 0;
    for (const value of values) {
        const n = Number(value);
        if (Number.isFinite(n)) {
            total += n;
            count++;
        }
    }
    return count === 0 ? Number.NaN : total;
};
