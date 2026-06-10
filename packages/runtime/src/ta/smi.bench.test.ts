// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";
import { smi } from "./smi.js";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon. SMI
// composes highest/lowest + 4 EMA layers + signal EMA — each O(1)
// amortised per bar. 10k bars fits well under 300ms on CI Linux.
const THRESHOLD_MS = 1500;

describe("ta.smi threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, () => smi("slot").smi.current);
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
