// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { stdev } from "./stdev";

const THRESHOLD_MS = 400;

describe("ta.stdev threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, (bar) => stdev("slot", bar.close, 20).current);
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
