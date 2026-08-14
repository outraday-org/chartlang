// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { extendedSession, isOpen, nySessionBounds, regularSession } from "./sessionBoundaries.js";
import { createSessionCalendar } from "./sessionCalendar.js";

const NY = "America/New_York";
// 2024-11-29 is the Black Friday half day; 2024-11-28 is Thanksgiving.
const HALF_DAY = createSessionCalendar([
    { dayKey: "2024-11-29", kind: "halfDay", closeMinutes: 13 * 60 },
]);
const HOLIDAY = createSessionCalendar([{ dayKey: "2024-11-28", kind: "closed" }]);

describe("session boundaries", () => {
    it("returns null for weekend sessions", () => {
        const saturday = Date.UTC(2024, 2, 2, 15, 0);
        expect(regularSession("America/New_York", saturday)).toBeNull();
        expect(extendedSession("America/New_York", saturday)).toBeNull();
    });

    it("uses half-open regular sessions", () => {
        const open = Date.UTC(2024, 2, 1, 14, 30);
        const close = Date.UTC(2024, 2, 1, 21, 0);
        expect(isOpen("America/New_York", open, "regular")).toBe(true);
        expect(isOpen("America/New_York", close, "regular")).toBe(false);
    });

    it("answers extended-session openness through the extended bounds", () => {
        const preMarket = Date.UTC(2024, 2, 1, 10, 0);
        expect(isOpen("America/New_York", preMarket, "extended")).toBe(true);
        expect(isOpen("America/New_York", preMarket, "regular")).toBe(false);
    });

    it("falls back to a synthetic noon-centred window for weekend nySessionBounds", () => {
        const saturday = Date.UTC(2024, 2, 2, 15, 0);
        expect(nySessionBounds(saturday)).toEqual({
            startMs: Date.UTC(2024, 2, 2, 14, 30),
            endMs: Date.UTC(2024, 2, 2, 21, 0),
        });
    });

    it("returns New York regular bounds", () => {
        const t = Date.UTC(2024, 2, 1, 16, 0);
        expect(nySessionBounds(t)).toEqual({
            startMs: Date.UTC(2024, 2, 1, 14, 30),
            endMs: Date.UTC(2024, 2, 1, 21, 0),
        });
    });
});

describe("session boundaries — exchange calendar", () => {
    // 2024-11-29 (Black Friday) closes at 13:00 EST = 18:00 UTC.
    const midMorning = Date.UTC(2024, 10, 29, 15, 0);

    it("truncates the regular session to a half day's early close", () => {
        expect(regularSession(NY, midMorning, HALF_DAY)).toEqual({
            startMs: Date.UTC(2024, 10, 29, 14, 30),
            endMs: Date.UTC(2024, 10, 29, 18, 0),
        });
    });

    it("truncates the extended session to the same early close", () => {
        expect(extendedSession(NY, midMorning, HALF_DAY)).toEqual({
            startMs: Date.UTC(2024, 10, 29, 9, 0),
            endMs: Date.UTC(2024, 10, 29, 18, 0),
        });
    });

    it("flips isOpen false at the early close", () => {
        const beforeClose = Date.UTC(2024, 10, 29, 17, 59);
        const atClose = Date.UTC(2024, 10, 29, 18, 0);
        expect(isOpen(NY, beforeClose, "regular", HALF_DAY)).toBe(true);
        expect(isOpen(NY, atClose, "regular", HALF_DAY)).toBe(false);
        expect(isOpen(NY, atClose, "extended", HALF_DAY)).toBe(false);
        // Same instants without the calendar: a normal full session.
        expect(isOpen(NY, atClose, "regular")).toBe(true);
    });

    it("leaves a window that already ends before the early close alone", () => {
        const lateClose = createSessionCalendar([
            { dayKey: "2024-11-29", kind: "halfDay", closeMinutes: 23 * 60 },
        ]);
        expect(regularSession(NY, midMorning, lateClose)).toEqual(regularSession(NY, midMorning));
    });

    it("has no session at all on a closed day", () => {
        const thanksgiving = Date.UTC(2024, 10, 28, 15, 0);
        expect(regularSession(NY, thanksgiving, HOLIDAY)).toBeNull();
        expect(extendedSession(NY, thanksgiving, HOLIDAY)).toBeNull();
        for (const hour of [5, 10, 15, 20]) {
            expect(isOpen(NY, Date.UTC(2024, 10, 28, hour, 0), "regular", HOLIDAY)).toBe(false);
            expect(isOpen(NY, Date.UTC(2024, 10, 28, hour, 0), "extended", HOLIDAY)).toBe(false);
        }
    });

    it("falls back to the synthetic window for nySessionBounds on a closed day", () => {
        const thanksgiving = Date.UTC(2024, 10, 28, 15, 0);
        expect(nySessionBounds(thanksgiving, HOLIDAY)).toEqual({
            startMs: Date.UTC(2024, 10, 28, 14, 30),
            endMs: Date.UTC(2024, 10, 28, 21, 0),
        });
    });

    it("narrows nySessionBounds on a half day", () => {
        expect(nySessionBounds(midMorning, HALF_DAY)).toEqual({
            startMs: Date.UTC(2024, 10, 29, 14, 30),
            endMs: Date.UTC(2024, 10, 29, 18, 0),
        });
    });

    it("keeps the weekend branch ahead of the calendar, so a Saturday row is inert", () => {
        const saturday = Date.UTC(2024, 10, 30, 15, 0);
        const saturdayHalfDay = createSessionCalendar([
            { dayKey: "2024-11-30", kind: "halfDay", closeMinutes: 13 * 60 },
        ]);
        expect(regularSession(NY, saturday, saturdayHalfDay)).toBeNull();
    });

    it("fails open on a day the calendar says nothing about", () => {
        const wednesday = Date.UTC(2024, 10, 27, 15, 0);
        expect(regularSession(NY, wednesday, HALF_DAY)).toEqual(regularSession(NY, wednesday));
        expect(isOpen(NY, wednesday, "regular", HALF_DAY)).toBe(true);
    });
});
