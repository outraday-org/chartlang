// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Civil-date arithmetic follows Howard Hinnant's public-domain
// `civil_from_days` / `days_from_civil` algorithm
// (http://howardhinnant.github.io/date_algorithms.html). Algorithm only —
// the integer routines are reimplemented in chartlang style, not transcribed.

const DAY_MS = 86_400_000;

/**
 * Integer floor-division rounding toward −∞ (unlike JS `/ | 0`, which
 * truncates toward `0`). Required so pre-1970 epochs split correctly.
 *
 * @since 1.5
 * @stable
 * @example
 *     // import { floorDiv } from "@invinite-org/chartlang-runtime";
 *     // floorDiv(-1, 86_400_000); // -1, not 0
 */
export function floorDiv(a: number, b: number): number {
    return Math.floor(a / b);
}

/**
 * Non-negative modulo (Euclidean) — `mod(-1, 7) === 6`, unlike JS `%`
 * which would yield `-1`. Pairs with {@link floorDiv} for correct
 * pre-epoch date math.
 *
 * @since 1.5
 * @stable
 * @example
 *     // import { mod } from "@invinite-org/chartlang-runtime";
 *     // mod(-1, 7); // 6
 */
export function mod(a: number, b: number): number {
    return a - floorDiv(a, b) * b;
}

/**
 * The civil date for a count of days since the Unix epoch
 * (1970-01-01). `m` is `1..12`, `d` is `1..31`. Pure integer
 * arithmetic — correct for negative (pre-epoch) `z`.
 *
 * @since 1.5
 * @stable
 * @example
 *     // import { civilFromDays } from "@invinite-org/chartlang-runtime";
 *     // civilFromDays(0); // { y: 1970, m: 1, d: 1 }
 */
export function civilFromDays(z: number): { y: number; m: number; d: number } {
    const shifted = z + 719_468;
    const era = floorDiv(shifted >= 0 ? shifted : shifted - 146_096, 146_097);
    const doe = shifted - era * 146_097; // [0, 146096]
    const yoe = floorDiv(
        doe - floorDiv(doe, 1460) + floorDiv(doe, 36_524) - floorDiv(doe, 146_096),
        365,
    ); // [0, 399]
    const y = yoe + era * 400;
    const doy = doe - (365 * yoe + floorDiv(yoe, 4) - floorDiv(yoe, 100)); // [0, 365]
    const mp = floorDiv(5 * doy + 2, 153); // [0, 11]
    const d = doy - floorDiv(153 * mp + 2, 5) + 1; // [1, 31]
    const m = mp < 10 ? mp + 3 : mp - 9; // [1, 12]
    return { y: m <= 2 ? y + 1 : y, m, d };
}

/**
 * Days since the Unix epoch (1970-01-01) for a civil `y` / `m` (`1..12`)
 * / `d` (`1..31`). Inverse of {@link civilFromDays}. Pure integer
 * arithmetic — correct for pre-epoch dates.
 *
 * @since 1.5
 * @stable
 * @example
 *     // import { daysFromCivil } from "@invinite-org/chartlang-runtime";
 *     // daysFromCivil(1970, 1, 1); // 0
 */
export function daysFromCivil(y: number, m: number, d: number): number {
    const yy = m <= 2 ? y - 1 : y;
    const era = floorDiv(yy >= 0 ? yy : yy - 399, 400);
    const yoe = yy - era * 400; // [0, 399]
    const doy = floorDiv(153 * (m > 2 ? m - 3 : m + 9) + 2, 5) + d - 1; // [0, 365]
    const doe = yoe * 365 + floorDiv(yoe, 4) - floorDiv(yoe, 100) + doy; // [0, 146096]
    return era * 146_097 + doe - 719_468;
}

/**
 * Split a UTC ms epoch (after pre-shifting by `offsetMin` minutes) into
 * civil fields. `dow` is `0=Sun .. 6=Sat`, derived from the day count
 * (`mod(z + 4, 7)` — 1970-01-01 was a Thursday, index 4). All integer
 * arithmetic on the floored ms — no `Date`.
 *
 * @since 1.5
 * @stable
 * @example
 *     // import { splitEpoch } from "@invinite-org/chartlang-runtime";
 *     // splitEpoch(0, 0); // { y: 1970, m: 1, d: 1, hh: 0, mm: 0, ss: 0, dow: 4 }
 */
export function splitEpoch(
    ms: number,
    offsetMin: number,
): { y: number; m: number; d: number; hh: number; mm: number; ss: number; dow: number } {
    const local = Math.floor(ms) + offsetMin * 60_000;
    const z = floorDiv(local, DAY_MS);
    const secondsOfDay = floorDiv(mod(local, DAY_MS), 1000);
    const { y, m, d } = civilFromDays(z);
    return {
        y,
        m,
        d,
        hh: floorDiv(secondsOfDay, 3600),
        mm: floorDiv(mod(secondsOfDay, 3600), 60),
        ss: mod(secondsOfDay, 60),
        dow: mod(z + 4, 7),
    };
}
