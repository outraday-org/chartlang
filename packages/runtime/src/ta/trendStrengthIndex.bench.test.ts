// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { trendStrengthIndex } from "./trendStrengthIndex";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon. Pearson is
// O(length) per close (window-rescan), so for length=20 over 10k bars
// it's ~200k ops; pair with `aroon` baseline at 300ms.
const THRESHOLD_MS = 1500;

describe("ta.trendStrengthIndex threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(
            10_000,
            1,
            (bar) => trendStrengthIndex("slot", bar.close, 20).current,
        );
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
