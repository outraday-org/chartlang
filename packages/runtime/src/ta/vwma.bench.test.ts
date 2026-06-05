// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { vwma } from "./vwma";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon. VWMA walks
// two parallel windows per close — roughly 1.5× SMA's budget per
// task §10.
const THRESHOLD_MS = 300;

describe("ta.vwma threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, (bar) => vwma("slot", bar.close, 20).current);
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
