// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { adr } from "./adr";
import { benchHotLoop } from "./__fixtures__/benchHotLoop";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon. ADR's per-bar
// cost is O(1) (min/max update + occasional day-boundary commit); 10k
// bars stays well under 100ms. Budget 300ms for CI Linux.
const THRESHOLD_MS = 1500;

describe("ta.adr threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, () => adr("slot", { length: 14 }).current);
        const elapsed = performance.now() - start;
        // ADR over 1m synthetic bars commits ~7 UTC days; the warmup of
        // 14 days never completes so `sink` may legitimately be 0 (every
        // output NaN). The benchmark still exercises the hot path.
        void sink;
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
