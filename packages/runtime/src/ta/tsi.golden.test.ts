// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars.js";
import { tsi } from "./tsi.js";

/**
 * Golden hash pinned against a 100-bar Mulberry32(seed=42) synthetic
 * walk over default opts (25, 13, 13). Hashes tsi first, then signal.
 */
describe("ta.tsi — golden", () => {
    it("matches the pinned hash for 100 bars × default opts (25, 13, 13)", () => {
        const bars = syntheticBars(100, 42);
        const ts: number[] = [];
        const ss: number[] = [];
        harness(bars, bars.length + 1, (bar) => {
            const t = tsi("slot", bar.close);
            ts.push(t.tsi.current);
            ss.push(t.signal.current);
            return null;
        });
        const combined = [...ts, ...ss];
        // Captured on first deterministic green run.
        expect(hashFloat64Array(combined)).toBe("cde92bc0");
    });
});
