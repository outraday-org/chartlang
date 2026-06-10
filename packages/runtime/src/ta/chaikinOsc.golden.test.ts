// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars.js";
import { chaikinOsc } from "./chaikinOsc.js";

describe("ta.chaikinOsc — golden", () => {
    it("matches the pinned hash for 100 bars × default opts (3, 10)", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(bars, bars.length + 1, () => chaikinOsc("slot").current);
        // Captured on first deterministic green run.
        expect(hashFloat64Array(out)).toBe("0e5a6477");
    });
});
