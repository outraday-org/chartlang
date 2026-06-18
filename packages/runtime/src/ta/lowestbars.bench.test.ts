// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";
import { lowestbars } from "./lowestbars.js";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon. 10k bars
// through an O(length) per-close argmin walk — comparable to ta.lowest;
// budget 1500ms for CI Linux headroom.
const THRESHOLD_MS = 1500;

describe("ta.lowestbars threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, (bar) => lowestbars("slot", bar.low, 20).current);
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
