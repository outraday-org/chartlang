// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Time } from "../types";
import { getFormatter } from "./_lib/dateTimeFormatCache";
import type { Weekday } from "./types";

const WEEKDAYS = Object.freeze(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);

/**
 * Return the local weekday in `tz`, where Sunday is 0.
 *
 * @since 0.6
 * @stable
 * @example
 *     weekday("UTC", 1_704_067_200_000);
 */
export function weekday(tz: string, t: Time): Weekday {
    const part = getFormatter(tz, { weekday: "short" })
        .formatToParts(t)
        .find((p) => p.type === "weekday");
    const index = WEEKDAYS.indexOf(part?.value ?? "");
    if (index < 0) throw new Error(`weekday: unsupported Intl weekday ${part?.value ?? "<none>"}`);
    return index as Weekday;
}
