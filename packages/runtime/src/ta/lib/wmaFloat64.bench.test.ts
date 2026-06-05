// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { syntheticBars } from "../__fixtures__/syntheticBars";
import { wmaFloat64 } from "./wmaFloat64";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon. 10k bars
// through wmaFloat64 × length=20 takes a few ms on M2; budget 300ms
// for CI Linux runners.
const THRESHOLD_MS = 300;

describe("wmaFloat64 threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const source = new Float64Array(syntheticBars(10_000, 1).map((b) => b.close));
        const start = performance.now();
        const out = wmaFloat64(source, 20);
        const elapsed = performance.now() - start;
        expect(Number.isFinite(out[out.length - 1])).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
