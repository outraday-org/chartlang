// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { chandeKrollStop } from "./chandeKrollStop";
import { benchHotLoop } from "./__fixtures__/benchHotLoop";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon. CKS composes
// ATR + highest + lowest sub-slots (each O(1) per close) plus a
// second-pass walk of `smoothingLength` entries — well under the
// Wave-5/6 baseline at length=10 / smoothingLength=9.
const THRESHOLD_MS = 300;

describe("ta.chandeKrollStop threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, () => chandeKrollStop("slot").long.current);
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
