// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { mfi } from "./mfi";

// THRESHOLD_MS — ceil(median × 3). ta.mfi is a per-bar typical-price
// + 4 ring-buffer slot operations; well under the 300 ms ceiling
// over 10k bars.
const THRESHOLD_MS = 300;

describe("ta.mfi threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, () => mfi("slot", 14).current);
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
