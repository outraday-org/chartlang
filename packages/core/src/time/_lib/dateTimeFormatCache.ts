// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

const CACHE = new Map<string, Intl.DateTimeFormat>();

/**
 * Return an `Intl.DateTimeFormat` cached by timezone and field options.
 *
 * @since 0.6
 * @stable
 * @example
 *     const formatter = getFormatter("UTC", { year: "numeric" });
 *     void formatter;
 */
export function getFormatter(tz: string, fields: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
    const key = `${tz}|${JSON.stringify(fields)}`;
    const cached = CACHE.get(key);
    if (cached !== undefined) return cached;
    const formatter = new Intl.DateTimeFormat("en-US", { timeZone: tz, ...fields });
    CACHE.set(key, formatter);
    return formatter;
}
