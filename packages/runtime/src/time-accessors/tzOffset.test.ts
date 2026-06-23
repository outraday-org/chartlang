// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { resolveOffsetMinutes } from "./tzOffset.js";

describe("resolveOffsetMinutes — UTC aliases", () => {
    it.each(["", "UTC", "Etc/UTC", "GMT", "Z", "  utc  ", "z"])(
        "resolves %j to a zero offset",
        (tz) => {
            expect(resolveOffsetMinutes(tz)).toEqual({ offsetMin: 0, dstUnsupported: false });
        },
    );
});

describe("resolveOffsetMinutes — explicit fixed offsets", () => {
    it("parses +HH:MM", () => {
        expect(resolveOffsetMinutes("+05:30")).toEqual({ offsetMin: 330, dstUnsupported: false });
    });

    it("parses -HH:MM", () => {
        expect(resolveOffsetMinutes("-08:00")).toEqual({ offsetMin: -480, dstUnsupported: false });
    });

    it("parses +HHMM (no colon)", () => {
        expect(resolveOffsetMinutes("+0545")).toEqual({ offsetMin: 345, dstUnsupported: false });
    });

    it("parses +HH (hours only)", () => {
        expect(resolveOffsetMinutes("+5")).toEqual({ offsetMin: 300, dstUnsupported: false });
    });

    it("parses UTC±H", () => {
        expect(resolveOffsetMinutes("UTC+5")).toEqual({ offsetMin: 300, dstUnsupported: false });
        expect(resolveOffsetMinutes("GMT-3:30")).toEqual({
            offsetMin: -210,
            dstUnsupported: false,
        });
    });

    it("parses Etc/GMT±H with the inverted POSIX sign", () => {
        // Etc/GMT-5 is UTC+5.
        expect(resolveOffsetMinutes("Etc/GMT-5")).toEqual({
            offsetMin: 300,
            dstUnsupported: false,
        });
        expect(resolveOffsetMinutes("Etc/GMT+8")).toEqual({
            offsetMin: -480,
            dstUnsupported: false,
        });
    });
});

describe("resolveOffsetMinutes — rejected to UTC + dstUnsupported", () => {
    it.each([
        "America/New_York",
        "Europe/London",
        "Asia/Kolkata",
        "+25:00", // hour out of range
        "+05:99", // minute out of range
        "UTC+30", // UTC-prefixed hour out of range
        "Etc/GMT-30", // Etc hour out of range
        "garbage",
    ])("flags %j as DST-unsupported with a zero offset", (tz) => {
        expect(resolveOffsetMinutes(tz)).toEqual({ offsetMin: 0, dstUnsupported: true });
    });
});
