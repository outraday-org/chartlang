// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { williamsFractal } from "./williamsFractal";
import { benchHotLoop } from "./__fixtures__/benchHotLoop";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon. Williams
// Fractal is O(length) per close (centred window scan). Default
// length=2 → 5-bar window → trivial; 10k bars well under baseline.
const THRESHOLD_MS = 1500;

describe("ta.williamsFractal threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, () => {
            const v = williamsFractal("slot").up.current;
            return Number.isFinite(v) ? v : 0;
        });
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
