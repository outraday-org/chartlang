// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// The single source of the chartlang UTC-first determinism policy: only UTC
// and explicit fixed offsets resolve to a numeric minute shift. A DST-bearing
// IANA region resolves to UTC + a `dstUnsupported` flag — NEVER an `Intl`
// lookup (whose output varies by host ICU/tz-data version).

/** UTC-equivalent zone names that resolve to a zero offset. */
const UTC_ALIASES = new Set(["", "UTC", "ETC/UTC", "GMT", "Z"]);

/**
 * The resolution of a timezone string to a fixed UTC offset in minutes.
 * `dstUnsupported` is `true` when `tz` named a DST-bearing IANA region the
 * UTC-first runtime cannot honour — callers then use the `0` offset AND raise
 * a one-time `tz-dst-unsupported` diagnostic.
 *
 * @since 1.5
 * @stable
 * @example
 *     // import type { ResolvedOffset } from "@invinite-org/chartlang-runtime";
 *     // const o: ResolvedOffset = { offsetMin: 0, dstUnsupported: false };
 */
export type ResolvedOffset = { readonly offsetMin: number; readonly dstUnsupported: boolean };

const UTC: ResolvedOffset = { offsetMin: 0, dstUnsupported: false };
const DST_UNSUPPORTED: ResolvedOffset = { offsetMin: 0, dstUnsupported: true };

// `+HH:MM` / `-HH:MM` / `+HHMM` / `+HH` — a leading sign then 1-2 hour digits
// and optional 2 minute digits.
const SIGNED_OFFSET = /^([+-])(\d{1,2})(?::?(\d{2}))?$/;
// `UTC±H[:MM]` / `GMT±H[:MM]` — the offset has the same sign as the number.
const UTC_PREFIXED = /^(?:UTC|GMT)([+-]\d{1,2}(?::?\d{2})?)$/;
// `Etc/GMT±H` — POSIX-style, the sign is INVERTED (`Etc/GMT-5` is UTC+5).
const ETC_GMT = /^ETC\/GMT([+-])(\d{1,2})$/;

function parseSignedOffset(value: string): number | null {
    const match = SIGNED_OFFSET.exec(value);
    if (match === null) return null;
    const hours = Number(match[2]);
    const minutes = match[3] === undefined ? 0 : Number(match[3]);
    if (hours > 23 || minutes > 59) return null;
    const magnitude = hours * 60 + minutes;
    return match[1] === "-" ? -magnitude : magnitude;
}

/**
 * Resolve a timezone string to a fixed UTC offset. UTC aliases and explicit
 * fixed offsets (`±HH:MM`, `UTC±H`, `Etc/GMT±H`) parse to integer minutes; any
 * other (region) name returns the zero offset flagged `dstUnsupported`. Pure —
 * never calls `Intl`, so the result is byte-reproducible across hosts.
 *
 * @since 1.5
 * @stable
 * @example
 *     // import { resolveOffsetMinutes } from "@invinite-org/chartlang-runtime";
 *     // resolveOffsetMinutes("+05:30"); // { offsetMin: 330, dstUnsupported: false }
 *     // resolveOffsetMinutes("America/New_York"); // { offsetMin: 0, dstUnsupported: true }
 */
export function resolveOffsetMinutes(tz: string): ResolvedOffset {
    const normalized = tz.trim().toUpperCase();
    if (UTC_ALIASES.has(normalized)) return UTC;

    const signed = parseSignedOffset(normalized);
    if (signed !== null) return { offsetMin: signed, dstUnsupported: false };

    const utcPrefixed = UTC_PREFIXED.exec(normalized);
    if (utcPrefixed !== null) {
        const minutes = parseSignedOffset(utcPrefixed[1]);
        if (minutes !== null) return { offsetMin: minutes, dstUnsupported: false };
    }

    const etcGmt = ETC_GMT.exec(normalized);
    if (etcGmt !== null) {
        const hours = Number(etcGmt[2]);
        if (hours <= 23) {
            // POSIX inverts the sign: `Etc/GMT-5` is UTC+5.
            const magnitude = hours * 60;
            return { offsetMin: etcGmt[1] === "-" ? magnitude : -magnitude, dstUnsupported: false };
        }
    }

    return DST_UNSUPPORTED;
}
