// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it, vi } from "vitest";

import { weekday } from "./weekday.js";

describe("weekday", () => {
    it("returns Sunday as 0 through Saturday as 6", () => {
        const start = Date.UTC(2024, 0, 7);
        for (let i = 0; i < 7; i += 1) {
            expect(weekday("UTC", start + i * 86_400_000)).toBe(i);
        }
    });

    it("uses the requested timezone", () => {
        expect(weekday("Asia/Tokyo", Date.UTC(2024, 0, 7, 15))).toBe(1);
    });

    it("throws when Intl yields no recognised weekday part", () => {
        const spy = vi.spyOn(Intl.DateTimeFormat.prototype, "formatToParts").mockReturnValue([]);
        try {
            expect(() => weekday("UTC", 0)).toThrow("weekday: unsupported Intl weekday <none>");
        } finally {
            spy.mockRestore();
        }
    });

    it("throws when Intl yields an unknown weekday name", () => {
        const spy = vi
            .spyOn(Intl.DateTimeFormat.prototype, "formatToParts")
            .mockReturnValue([{ type: "weekday", value: "Xxx" }]);
        try {
            expect(() => weekday("UTC", 0)).toThrow("weekday: unsupported Intl weekday Xxx");
        } finally {
            spy.mockRestore();
        }
    });
});
