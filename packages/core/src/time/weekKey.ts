// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Time } from "../types.js";
import { localDateParts } from "./nyDayKey.js";

function isoWeek(year: number, month: number, day: number): { year: number; week: number } {
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const weekYear = date.getUTCFullYear();
    const yearStart = new Date(Date.UTC(weekYear, 0, 1));
    const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
    return { year: weekYear, week };
}

/**
 * Return the ISO week key (`GGGG-Www`) for `t` in `tz`.
 *
 * @since 0.6
 * @stable
 * @example
 *     weekKey("UTC", 1_704_067_200_000);
 */
export function weekKey(tz: string, t: Time): string {
    const parts = localDateParts(tz, t);
    const { year, week } = isoWeek(Number(parts.year), Number(parts.month), Number(parts.day));
    return `${year}-W${String(week).padStart(2, "0")}`;
}
