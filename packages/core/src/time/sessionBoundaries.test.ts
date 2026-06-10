// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { extendedSession, isOpen, nySessionBounds, regularSession } from "./sessionBoundaries";

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
