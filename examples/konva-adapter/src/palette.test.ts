// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { DEFAULT_PALETTE } from "./palette.js";

describe("DEFAULT_PALETTE", () => {
    it("uses the canonical TradingView bull/bear hex values", () => {
        expect(DEFAULT_PALETTE.candleBullBody).toBe("#26a69a");
        expect(DEFAULT_PALETTE.candleBearBody).toBe("#ef5350");
    });

    it("fills every mandatory slot", () => {
        expect(DEFAULT_PALETTE.background).toBeTruthy();
        expect(DEFAULT_PALETTE.candleWick).toBeTruthy();
        expect(DEFAULT_PALETTE.paneBorder).toBeTruthy();
        expect(DEFAULT_PALETTE.plotDefault).toBeTruthy();
        expect(DEFAULT_PALETTE.hlineDefault).toBeTruthy();
        expect(DEFAULT_PALETTE.glyphText).toBeTruthy();
    });

    it("is frozen", () => {
        expect(Object.isFrozen(DEFAULT_PALETTE)).toBe(true);
    });
});
