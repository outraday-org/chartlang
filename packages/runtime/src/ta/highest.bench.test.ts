// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { highest } from "./highest";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon. 10k bars
// through a monotonic-deque max — slightly heavier than SMA's running
// sum but still well under 100ms on M2; budget 300ms for CI Linux.
const THRESHOLD_MS = 1500;

describe("ta.highest threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, (bar) => highest("slot", bar.high, 20).current);
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
