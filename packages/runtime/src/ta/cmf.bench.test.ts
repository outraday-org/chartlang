// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { cmf } from "./cmf";

// THRESHOLD_MS — ceil(median × 3). ta.cmf is rolling-sum with
// substitute-on-evict — well under the 300 ms ceiling over 10k bars
// at length 20.
const THRESHOLD_MS = 1500;

describe("ta.cmf threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, () => cmf("slot", 20).current);
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
