// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars.js";
import { coppock } from "./coppock.js";

/**
 * Golden hash pinned against a 100-bar Mulberry32(seed=42) synthetic
 * walk over default opts (11, 14, 10).
 */
describe("ta.coppock — golden", () => {
    it("matches the pinned hash for 100 bars × default opts (11, 14, 10)", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(bars, bars.length + 1, (bar) => coppock("slot", bar.close).current);
        const h = hashFloat64Array(out);
        // Captured on first deterministic green run.
        expect(h).toBe("55eced05");
    });
});
