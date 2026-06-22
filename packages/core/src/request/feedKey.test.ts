// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { feedKey } from "./feedKey.js";

describe("feedKey", () => {
    it("encodes a present symbol as `<symbol>@<interval>`", () => {
        expect(feedKey("AMEX:SPY", "1D")).toBe("AMEX:SPY@1D");
        expect(feedKey("NASDAQ:QQQ", "1W")).toBe("NASDAQ:QQQ@1W");
    });

    it("collapses an omitted symbol to the bare interval (chart-symbol back-compat)", () => {
        expect(feedKey(undefined, "1D")).toBe("1D");
        expect(feedKey(undefined, "5m")).toBe("5m");
    });

    it("collapses an empty-string symbol identically to omitted", () => {
        expect(feedKey("", "1D")).toBe("1D");
        expect(feedKey("", "1D")).toBe(feedKey(undefined, "1D"));
    });

    it("produces distinct keys for the same interval across symbols and the chart", () => {
        const chart = feedKey(undefined, "1D");
        const spy = feedKey("AMEX:SPY", "1D");
        const qqq = feedKey("NASDAQ:QQQ", "1D");
        expect(new Set([chart, spy, qqq]).size).toBe(3);
    });

    it("is deterministic for a given pair", () => {
        expect(feedKey("AMEX:SPY", "1D")).toBe(feedKey("AMEX:SPY", "1D"));
    });
});
