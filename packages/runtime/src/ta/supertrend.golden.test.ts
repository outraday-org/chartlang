// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars.js";
import { supertrend } from "./supertrend.js";

describe("ta.supertrend — golden", () => {
    it("matches the pinned hashes for 100 bars × length=10 × multiplier=3", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(bars, bars.length + 1, () => {
            const s = supertrend("slot", { length: 10, multiplier: 3 });
            return { line: s.line.current, direction: s.direction.current };
        });
        // Hashes captured during implementation against
        // syntheticBars(100, 42) with length=10 / multiplier=3;
        // re-pin if the math intentionally changes.
        expect(hashFloat64Array(out.map((o) => o.line))).toBe("8551fb3b");
        expect(hashFloat64Array(out.map((o) => o.direction))).toBe("9e1d23d0");
    });
});
