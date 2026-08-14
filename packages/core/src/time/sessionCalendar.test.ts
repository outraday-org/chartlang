// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { SessionCalendarDay } from "./sessionCalendar.js";
import { createSessionCalendar } from "./sessionCalendar.js";

describe("createSessionCalendar", () => {
    it("looks up a stored day and returns null for an unknown key", () => {
        const calendar = createSessionCalendar([
            { dayKey: "2024-11-28", kind: "closed" },
            { dayKey: "2024-11-29", kind: "halfDay", closeMinutes: 780 },
        ]);
        expect(calendar.lookup("2024-11-28")).toEqual({ dayKey: "2024-11-28", kind: "closed" });
        expect(calendar.lookup("2024-11-29")).toEqual({
            dayKey: "2024-11-29",
            kind: "halfDay",
            closeMinutes: 780,
        });
        expect(calendar.lookup("2024-11-27")).toBeNull();
    });

    it("returns null from an empty calendar", () => {
        expect(createSessionCalendar([]).lookup("2024-11-28")).toBeNull();
    });

    it("lets a later row for the same day key win", () => {
        const calendar = createSessionCalendar([
            { dayKey: "2024-07-03", kind: "closed" },
            { dayKey: "2024-07-03", kind: "halfDay", closeMinutes: 780 },
        ]);
        expect(calendar.lookup("2024-07-03")).toEqual({
            dayKey: "2024-07-03",
            kind: "halfDay",
            closeMinutes: 780,
        });
    });

    it("accepts the inclusive minute-of-day bounds", () => {
        const calendar = createSessionCalendar([
            { dayKey: "a", kind: "halfDay", closeMinutes: 0 },
            { dayKey: "b", kind: "halfDay", closeMinutes: 1440 },
        ]);
        expect(calendar.lookup("a")).not.toBeNull();
        expect(calendar.lookup("b")).not.toBeNull();
    });

    // The rows arrive as JSON across the host membrane, so the runtime guard is
    // reachable even though the discriminated union blocks a typed producer.
    const badRow = (closeMinutes: unknown): SessionCalendarDay =>
        ({ dayKey: "2024-11-29", kind: "halfDay", closeMinutes }) as SessionCalendarDay;

    it("rejects a half-day whose close minute is missing or fractional", () => {
        expect(() => createSessionCalendar([badRow(undefined)])).toThrow(
            /needs an integer closeMinutes/,
        );
        expect(() => createSessionCalendar([badRow(780.5)])).toThrow(
            /needs an integer closeMinutes/,
        );
    });

    it("rejects a half-day close minute outside [0, 1440]", () => {
        expect(() => createSessionCalendar([badRow(-1)])).toThrow(/got -1/);
        expect(() => createSessionCalendar([badRow(1441)])).toThrow(/got 1441/);
    });
});
