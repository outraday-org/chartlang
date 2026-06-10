// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";
import { stoch } from "./stoch.js";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon. Stoch
// composes `ta.highest` + `ta.lowest` + two `ta.sma` layers; each
// is O(1) amortised per bar (deque + running sum). 10k × default
// opts fits comfortably under 300ms on CI Linux runners.
const THRESHOLD_MS = 1500;

describe("ta.stoch threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, () => stoch("slot").d.current);
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
