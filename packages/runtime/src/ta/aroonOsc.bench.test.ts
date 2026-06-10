// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { aroonOsc } from "./aroonOsc.js";
import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";

// THRESHOLD_MS — ceil(median × 3). AroonOsc composes Aroon (one
// sub-slot scan) and adds one subtraction per bar; budget the same
// 300ms ceiling as Aroon.
const THRESHOLD_MS = 1500;

describe("ta.aroonOsc threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, () => aroonOsc("slot", 14).current);
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
