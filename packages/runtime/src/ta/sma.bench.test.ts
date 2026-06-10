// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";
import { sma } from "./sma.js";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon. 10k bars
// through ta.sma takes ~10ms on M2; budget 300ms for CI Linux runners.
const THRESHOLD_MS = 1500;

describe("ta.sma threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, (bar) => sma("slot", bar.close, 20).current);
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
