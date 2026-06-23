// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { parseSessionWindowMinutes } from "./sessionWindow.js";

describe("parseSessionWindowMinutes", () => {
    it("parses HHMM-HHMM", () => {
        expect(parseSessionWindowMinutes("0930-1600")).toEqual({
            startMinutes: 9 * 60 + 30,
            endMinutes: 16 * 60,
        });
    });

    it("parses HH:MM-HH:MM with colons", () => {
        expect(parseSessionWindowMinutes("09:30-16:00")).toEqual({
            startMinutes: 570,
            endMinutes: 960,
        });
    });

    it("parses a single-digit hour with no minutes", () => {
        expect(parseSessionWindowMinutes("9-16")).toEqual({ startMinutes: 540, endMinutes: 960 });
    });

    it("tolerates surrounding and inner whitespace", () => {
        expect(parseSessionWindowMinutes("  0930 - 1600  ")).toEqual({
            startMinutes: 570,
            endMinutes: 960,
        });
    });

    it("parses a midnight-wrap window verbatim (no normalization)", () => {
        expect(parseSessionWindowMinutes("2200-0400")).toEqual({
            startMinutes: 22 * 60,
            endMinutes: 4 * 60,
        });
    });

    it("returns null for a non-window string", () => {
        expect(parseSessionWindowMinutes("not-a-window")).toBeNull();
        expect(parseSessionWindowMinutes("0930")).toBeNull();
    });

    it("returns null for an out-of-range hour", () => {
        expect(parseSessionWindowMinutes("2500-1600")).toBeNull();
        expect(parseSessionWindowMinutes("0930-2400")).toBeNull();
    });

    it("returns null for an out-of-range minute", () => {
        expect(parseSessionWindowMinutes("09:60-16:00")).toBeNull();
        expect(parseSessionWindowMinutes("09:30-16:60")).toBeNull();
    });
});
