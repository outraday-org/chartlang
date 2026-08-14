// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { extendedSession, isOpen, nySessionBounds, regularSession } from "./sessionBoundaries.js";
import { createSessionCalendar } from "./sessionCalendar.js";
import type { SessionType } from "./types.js";

// A calendar that knows nothing must be indistinguishable from no calendar at
// all — that equivalence is what makes the parameter safe to add to a `@stable`
// surface, so it is asserted over arbitrary inputs rather than a few dates.
const EMPTY = createSessionCalendar([]);

const tzArb = fc.constantFrom(
    "America/New_York",
    "UTC",
    "Europe/London",
    "Asia/Tokyo",
    "Australia/Sydney",
);
// Roughly 1990-01-01 .. 2040-01-01, minute-aligned.
const timeArb = fc
    .integer({ min: 631_152_000, max: 2_208_988_800 })
    .map((seconds) => seconds * 1000);
const typeArb: fc.Arbitrary<SessionType> = fc.constantFrom("regular", "extended");

describe("session boundaries — empty calendar ≡ no calendar", () => {
    it("holds for every predicate", () => {
        fc.assert(
            fc.property(tzArb, timeArb, typeArb, (tz, t, type) => {
                expect(regularSession(tz, t, EMPTY)).toEqual(regularSession(tz, t));
                expect(extendedSession(tz, t, EMPTY)).toEqual(extendedSession(tz, t));
                expect(isOpen(tz, t, type, EMPTY)).toBe(isOpen(tz, t, type));
                expect(nySessionBounds(t, EMPTY)).toEqual(nySessionBounds(t));
            }),
            // Pinned like the runtime's property suites: a random seed here
            // would only ever produce flakes, never new information.
            { seed: 42, numRuns: 200 },
        );
    });
});
