// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars";
import { nz } from "./nz";

/**
 * Golden hash pinned against a 100-bar Mulberry32(seed=42) walk where
 * every 7th bar's close is replaced with NaN. `ta.nz` should pass
 * through every finite value and substitute `0` for the NaN bars.
 */
describe("ta.nz — golden", () => {
    it("matches the pinned hash for 100 bars with NaN every 7th", () => {
        const bars = syntheticBars(100, 42);
        const out = bars.map((b, i) => (i % 7 === 0 ? nz(Number.NaN, 0) : nz(b.close)));
        const h = hashFloat64Array(out);
        expect(h).toBe("9deda843");
    });
});
