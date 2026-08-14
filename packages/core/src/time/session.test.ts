// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { session } from "./session.js";
import { createSessionCalendar } from "./sessionCalendar.js";

describe("session namespace", () => {
    it("is frozen and delegates", () => {
        expect(Object.isFrozen(session)).toBe(true);
        expect(session.isOpen("America/New_York", Date.UTC(2024, 2, 1, 14, 30), "regular")).toBe(
            true,
        );
    });

    it("forwards an exchange calendar to every member", () => {
        const calendar = createSessionCalendar([
            { dayKey: "2024-11-28", kind: "closed" },
            { dayKey: "2024-11-29", kind: "halfDay", closeMinutes: 13 * 60 },
        ]);
        const thanksgiving = Date.UTC(2024, 10, 28, 15, 0);
        const afterEarlyClose = Date.UTC(2024, 10, 29, 18, 0);
        expect(session.regular("America/New_York", thanksgiving, calendar)).toBeNull();
        expect(session.extended("America/New_York", thanksgiving, calendar)).toBeNull();
        expect(session.isOpen("America/New_York", afterEarlyClose, "regular", calendar)).toBe(
            false,
        );
    });
});
