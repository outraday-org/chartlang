// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars";
import { stoch } from "./stoch";

/**
 * Golden hash pinned against a 100-bar Mulberry32(seed=42) synthetic
 * walk. The hash covers both `k` and `d` (k first, then d).
 */
describe("ta.stoch — golden", () => {
    it("matches the pinned hash for 100 bars × default opts (14, 3, 3)", () => {
        const bars = syntheticBars(100, 42);
        const ks: number[] = [];
        const ds: number[] = [];
        harness(bars, bars.length + 1, () => {
            const s = stoch("slot");
            ks.push(s.k.current);
            ds.push(s.d.current);
            return null;
        });
        const combined = [...ks, ...ds];
        expect(hashFloat64Array(combined)).toBe("dcace3e5");
    });
});
