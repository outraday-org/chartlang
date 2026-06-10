// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { nyDayKey } from "./nyDayKey";

describe("nyDayKey", () => {
    it("uses the America/New_York day across UTC midnight", () => {
        expect(nyDayKey(Date.UTC(2024, 2, 1, 4, 59))).toBe("2024-02-29");
        expect(nyDayKey(Date.UTC(2024, 2, 1, 5, 0))).toBe("2024-03-01");
    });

    it("is stable across DST transition days", () => {
        expect(nyDayKey(Date.UTC(2024, 2, 10, 7, 30))).toBe("2024-03-10");
        expect(nyDayKey(Date.UTC(2024, 10, 3, 6, 30))).toBe("2024-11-03");
    });
});
