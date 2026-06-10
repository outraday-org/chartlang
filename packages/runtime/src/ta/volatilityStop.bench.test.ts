// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";
import { volatilityStop } from "./volatilityStop.js";

// THRESHOLD_MS — pair with the Wave-5/6 S/R baseline at 300ms.
// VolatilityStop is O(1) per close plus a composed `ta.atr` (also
// O(1)); 10 000 bars runs well under the threshold on Apple silicon.
const THRESHOLD_MS = 1500;

describe("ta.volatilityStop threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, () => {
            const v = volatilityStop("slot", { length: 20, multiplier: 2 });
            const val = v.value.current;
            return Number.isFinite(val) ? val : 0;
        });
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
