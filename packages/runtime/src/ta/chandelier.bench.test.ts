// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { chandelier } from "./chandelier.js";
import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon. Chandelier
// composes ATR + highest + lowest sub-slots (each O(1) per close);
// 10k bars at length=22 is comfortably under the Wave-5/6 baseline.
const THRESHOLD_MS = 1500;

describe("ta.chandelier threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, () => chandelier("slot").long.current);
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
