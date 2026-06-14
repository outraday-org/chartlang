// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/lib/session-boundaries.ts
//   (commit fb882a97e018ea0cc9a451fb7d839dc8d894c08b, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.

import type { Time } from "../types.js";
import { getFormatter } from "./_lib/dateTimeFormatCache.js";
import { localDateParts } from "./nyDayKey.js";
import type { SessionBounds, SessionType } from "./types.js";
import { weekday } from "./weekday.js";

const MINUTE_MS = 60_000;

const OFFSET_FIELDS = Object.freeze({
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
} satisfies Intl.DateTimeFormatOptions);

function offsetMs(tz: string, instantMs: number): number {
    const parts = getFormatter(tz, OFFSET_FIELDS).formatToParts(instantMs);
    const fields: Record<string, string> = {};
    for (const part of parts) {
        fields[part.type] = part.value;
    }
    const asUtc = Date.UTC(
        Number(fields.year),
        Number(fields.month) - 1,
        Number(fields.day),
        Number(fields.hour),
        Number(fields.minute),
        Number(fields.second),
    );
    return asUtc - instantMs;
}

function zonedTimeToUtcMs(
    tz: string,
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
): number {
    const guess = Date.UTC(year, month - 1, day, hour, minute);
    const first = guess - offsetMs(tz, guess);
    const second = guess - offsetMs(tz, first);
    return second;
}

function sessionFor(
    tz: string,
    t: Time,
    startMinutes: number,
    endMinutes: number,
): SessionBounds | null {
    const dow = weekday(tz, t);
    if (dow === 0 || dow === 6) return null;
    const parts = localDateParts(tz, t);
    const year = Number(parts.year);
    const month = Number(parts.month);
    const day = Number(parts.day);
    const startMs = zonedTimeToUtcMs(tz, year, month, day, 0, startMinutes);
    const endMs = zonedTimeToUtcMs(tz, year, month, day, 0, endMinutes);
    return Object.freeze({ startMs, endMs });
}

/**
 * Return the regular 09:30-16:00 session bounds for the New York day
 * containing `t`.
 *
 * @since 0.6
 * @stable
 * @example
 *     nySessionBounds(1_709_251_200_000);
 */
export function nySessionBounds(t: Time): SessionBounds {
    const bounds = sessionFor("America/New_York", t, 9 * 60 + 30, 16 * 60);
    if (bounds !== null) return bounds;
    const parts = localDateParts("America/New_York", t);
    const noon = zonedTimeToUtcMs(
        "America/New_York",
        Number(parts.year),
        Number(parts.month),
        Number(parts.day),
        12,
        0,
    );
    return {
        startMs: noon - 150 * MINUTE_MS,
        endMs: noon + 240 * MINUTE_MS,
    };
}

/**
 * Return regular 09:30-16:00 session bounds in `tz`, or `null` on weekends.
 *
 * @since 0.6
 * @stable
 * @example
 *     regularSession("America/New_York", 1_709_251_200_000);
 */
export function regularSession(tz: string, t: Time): SessionBounds | null {
    return sessionFor(tz, t, 9 * 60 + 30, 16 * 60);
}

/**
 * Return extended 04:00-20:00 session bounds in `tz`, or `null` on weekends.
 *
 * @since 0.6
 * @stable
 * @example
 *     extendedSession("America/New_York", 1_709_251_200_000);
 */
export function extendedSession(tz: string, t: Time): SessionBounds | null {
    return sessionFor(tz, t, 4 * 60, 20 * 60);
}

/**
 * Test whether `t` falls inside the selected half-open session in `tz`.
 *
 * @since 0.6
 * @stable
 * @example
 *     isOpen("America/New_York", 1_709_251_200_000, "regular");
 */
export function isOpen(tz: string, t: Time, type: SessionType): boolean {
    const bounds = type === "regular" ? regularSession(tz, t) : extendedSession(tz, t);
    return bounds !== null && bounds.startMs <= t && t < bounds.endMs;
}
