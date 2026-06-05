// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { connorsRsi } from "./connorsRsi";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon. Connors RSI
// composes two `ta.rsi` sub-slots (each Wilder, O(1) per bar) + a
// per-bar percent-rank walk over the rocLength=100 window. 10k × 100
// = ~1M percent-rank ops total; fits comfortably under 300ms on CI
// Linux runners.
const THRESHOLD_MS = 300;

describe("ta.connorsRsi threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, (bar) => connorsRsi("slot", bar.close).current);
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
