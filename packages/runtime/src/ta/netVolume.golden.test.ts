// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars.js";
import { netVolume } from "./netVolume.js";

describe("ta.netVolume — golden", () => {
    it("matches the pinned hash for 100 bars × default", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(bars, bars.length + 1, () => netVolume("slot").current);
        // Equals the obv hash since the math is identical (cross-
        // checked in netVolume.property.test.ts).
        expect(hashFloat64Array(out)).toBe("829d24d9");
    });
});
