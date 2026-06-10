// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars.js";
import { connorsRsi } from "./connorsRsi.js";

/**
 * Golden hash pinned against a 200-bar Mulberry32(seed=42) synthetic
 * walk over default opts (3, 2, 100). 200 bars exceeds the default
 * rocLength=100 warmup so the percentRank window fully populates.
 */
describe("ta.connorsRsi — golden", () => {
    it("matches the pinned hash for 200 bars × default opts (3, 2, 100)", () => {
        const bars = syntheticBars(200, 42);
        const out = harness(bars, bars.length + 1, (bar) => connorsRsi("slot", bar.close).current);
        // Captured on first deterministic green run.
        expect(hashFloat64Array(out)).toBe("45276a1a");
    });
});
