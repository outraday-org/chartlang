// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { syntheticBars } from "../__fixtures__/syntheticBars";
import { vwmaFloat64 } from "./vwmaFloat64";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon. 10k bars
// through vwmaFloat64 × length=20 takes a few ms on M2; budget 300ms
// for CI Linux runners.
const THRESHOLD_MS = 1500;

describe("vwmaFloat64 threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const bars = syntheticBars(10_000, 1);
        const source = new Float64Array(bars.map((b) => b.close));
        // `+ 1` keeps every bar's volume positive — see bench.ts header.
        const volume = new Float64Array(bars.map((b) => b.volume + 1));
        const start = performance.now();
        const out = vwmaFloat64(source, volume, 20);
        const elapsed = performance.now() - start;
        expect(Number.isFinite(out[out.length - 1])).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
