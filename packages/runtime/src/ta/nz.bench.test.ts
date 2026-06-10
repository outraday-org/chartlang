// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { nz } from "./nz.js";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon. ta.nz is a
// branch + return so 10k iterations are dominated by loop overhead;
// budget 300ms for CI Linux runners (same as stateful Phase-1 primitives).
const THRESHOLD_MS = 1500;

describe("ta.nz threshold", () => {
    it("runs 10 000 iterations under threshold", () => {
        const bars = syntheticBars(10_000, 1);
        const start = performance.now();
        let sink = 0;
        for (let i = 0; i < bars.length; i += 1) {
            const v = i % 7 === 0 ? Number.NaN : bars[i].close;
            sink += nz(v, 0);
        }
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
