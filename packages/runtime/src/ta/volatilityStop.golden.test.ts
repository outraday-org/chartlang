// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars.js";
import { volatilityStop } from "./volatilityStop.js";

describe("ta.volatilityStop — golden", () => {
    it("matches the pinned hashes for 100 bars × length=20 × multiplier=2", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(bars, bars.length + 1, () => {
            const v = volatilityStop("slot", { length: 20, multiplier: 2 });
            return { value: v.value.current, direction: v.direction.current };
        });
        // Hashes captured during implementation against
        // syntheticBars(100, 42) with length=20 / multiplier=2;
        // re-pin if the math intentionally changes.
        expect(hashFloat64Array(out.map((o) => o.value))).toBe("15e481df");
        expect(hashFloat64Array(out.map((o) => o.direction))).toBe("cf28ed15");
    });
});
