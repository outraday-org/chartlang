// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { pvo } from "./pvo";

// THRESHOLD_MS — ceil(median × 3). ta.pvo composes three EMA
// sub-slots over bar.volume; well under the 300 ms ceiling over 10k
// bars.
const THRESHOLD_MS = 1500;

describe("ta.pvo threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, () => pvo("slot").signal.current);
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
