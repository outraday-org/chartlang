// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";
import { mcginley } from "./mcginley.js";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon. 10k bars
// through the scalar recurrence (no window walk).
const THRESHOLD_MS = 1500;

describe("ta.mcginley threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, (bar) => mcginley("slot", bar.close, 14).current);
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
