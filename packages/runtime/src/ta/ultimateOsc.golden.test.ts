// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars.js";
import { ultimateOsc } from "./ultimateOsc.js";

/**
 * Golden hash pinned against a 100-bar Mulberry32(seed=42) synthetic
 * walk over default opts (7, 14, 28).
 */
describe("ta.ultimateOsc — golden", () => {
    it("matches the pinned hash for 100 bars × default opts (7, 14, 28)", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(bars, bars.length + 1, () => ultimateOsc("slot").current);
        const h = hashFloat64Array(out);
        // Captured on first deterministic green run.
        expect(h).toBe("f1dd064d");
    });
});
