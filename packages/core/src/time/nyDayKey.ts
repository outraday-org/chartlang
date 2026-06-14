// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/lib/ny-day-key.ts
//   (commit fb882a97e018ea0cc9a451fb7d839dc8d894c08b, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.

import type { Time } from "../types.js";
import { getFormatter } from "./_lib/dateTimeFormatCache.js";

const NY_DAY_FIELDS = Object.freeze({
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
} satisfies Intl.DateTimeFormatOptions);

/**
 * Return local year-month-day parts for `t` in `tz`.
 *
 * @since 0.6
 * @stable
 * @example
 *     localDateParts("UTC", 1_704_067_200_000);
 */
export function localDateParts(
    tz: string,
    t: Time,
): { readonly year: string; readonly month: string; readonly day: string } {
    const parts = getFormatter(tz, NY_DAY_FIELDS).formatToParts(t);
    let year = "";
    let month = "";
    let day = "";
    for (const part of parts) {
        if (part.type === "year") year = part.value;
        else if (part.type === "month") month = part.value;
        else if (part.type === "day") day = part.value;
    }
    return { year, month, day };
}

/**
 * Return the `YYYY-MM-DD` key for `t` in `America/New_York`.
 *
 * @since 0.6
 * @stable
 * @example
 *     nyDayKey(1_709_251_200_000);
 */
export function nyDayKey(t: Time): string {
    const { year, month, day } = localDateParts("America/New_York", t);
    return `${year}-${month}-${day}`;
}
