// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";
import { ichimoku } from "./ichimoku.js";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon. Ichimoku
// composes 6 highest/lowest sub-slots (each O(length) per close in
// the worst case) — for length=52, that's ~600 ops × 10k bars =
// 6M ops; pair with a slightly higher baseline than other multi-
// output trend primitives.
const THRESHOLD_MS = 1500;

describe("ta.ichimoku threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, () => ichimoku("slot").tenkan.current);
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
