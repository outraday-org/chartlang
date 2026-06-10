// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars.js";
import { kst } from "./kst.js";

/**
 * Golden hash pinned against a 100-bar Mulberry32(seed=42) synthetic
 * walk over default opts. Hash covers both `kst` and `signal`
 * (kst first, then signal).
 */
describe("ta.kst — golden", () => {
    it("matches the pinned hash for 100 bars × default opts", () => {
        const bars = syntheticBars(100, 42);
        const ks: number[] = [];
        const ss: number[] = [];
        harness(bars, bars.length + 1, (bar) => {
            const k = kst("slot", bar.close);
            ks.push(k.kst.current);
            ss.push(k.signal.current);
            return null;
        });
        const combined = [...ks, ...ss];
        // Captured on first deterministic green run.
        expect(hashFloat64Array(combined)).toBe("97096822");
    });
});
