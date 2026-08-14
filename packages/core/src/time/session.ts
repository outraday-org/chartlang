// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Time } from "../types.js";
import { extendedSession, isOpen, regularSession } from "./sessionBoundaries.js";
import type { SessionCalendar } from "./sessionCalendar.js";
import type { SessionBounds, SessionType } from "./types.js";

/**
 * Frozen session helper namespace. Every member takes the same optional
 * trailing exchange `calendar`; omitting it is byte-identical to the
 * calendar-less behaviour.
 *
 * @since 0.6
 * @stable
 * @example
 *     const open = session.isOpen("America/New_York", 1_709_251_200_000, "regular");
 *     void open;
 */
export const session = Object.freeze({
    regular: regularSession,
    extended: extendedSession,
    isOpen,
}) satisfies {
    readonly regular: (tz: string, t: Time, calendar?: SessionCalendar) => SessionBounds | null;
    readonly extended: (tz: string, t: Time, calendar?: SessionCalendar) => SessionBounds | null;
    readonly isOpen: (
        tz: string,
        t: Time,
        type: SessionType,
        calendar?: SessionCalendar,
    ) => boolean;
};
