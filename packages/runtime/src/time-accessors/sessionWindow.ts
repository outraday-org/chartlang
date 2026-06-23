// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// The single source of the chartlang session-window grammar. Lifted out of
// `ta/sessionVolumeProfile.ts` so `ta.sessionVolumeProfile` and
// `session.isOpen` parse `"HH:MM-HH:MM"` windows through ONE regex — never a
// forked copy.

// Two `HH[:MM]` clock fields separated by `-` (optional surrounding whitespace).
// The minutes are optional (`"0930"` / `"930"` parse), and a `:` separator is
// also optional (`"09:30"` and `"0930"` are equivalent).
const SESSION_WINDOW = /^(\d{1,2})(?::?(\d{2}))?\s*-\s*(\d{1,2})(?::?(\d{2}))?$/;

/**
 * Parse a daily session window `"HH:MM-HH:MM"` / `"HHMM-HHMM"` into start/end
 * minute-of-day (`0..1439`). Returns `null` for any malformed spec or an
 * out-of-range hour (`>23`) / minute (`>59`). A window whose `end <= start`
 * is left as-is — the caller decides whether to treat it as a midnight wrap.
 *
 * @since 1.5
 * @stable
 * @example
 *     // import { parseSessionWindowMinutes } from "@invinite-org/chartlang-runtime";
 *     // parseSessionWindowMinutes("0930-1600"); // { startMinutes: 570, endMinutes: 960 }
 */
export function parseSessionWindowMinutes(
    spec: string,
): { startMinutes: number; endMinutes: number } | null {
    const match = SESSION_WINDOW.exec(spec.trim());
    if (match === null) return null;
    const startHour = Number(match[1]);
    const startMinute = match[2] === undefined ? 0 : Number(match[2]);
    const endHour = Number(match[3]);
    const endMinute = match[4] === undefined ? 0 : Number(match[4]);
    if (startHour < 0 || startHour > 23 || startMinute < 0 || startMinute > 59) return null;
    if (endHour < 0 || endHour > 23 || endMinute < 0 || endMinute > 59) return null;
    return {
        startMinutes: startHour * 60 + startMinute,
        endMinutes: endHour * 60 + endMinute,
    };
}
