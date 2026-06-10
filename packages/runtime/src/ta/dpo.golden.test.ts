// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars.js";
import { dpo } from "./dpo.js";

/**
 * Golden hash pinned against a 100-bar Mulberry32(seed=42) synthetic
 * walk over length=21 (TradingView default).
 */
describe("ta.dpo — golden", () => {
    it("matches the pinned hash for 100 bars × length=21", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(bars, bars.length + 1, (bar) => dpo("slot", bar.close, 21).current);
        // Captured on first deterministic green run.
        expect(hashFloat64Array(out)).toBe("42a32a87");
    });
});
