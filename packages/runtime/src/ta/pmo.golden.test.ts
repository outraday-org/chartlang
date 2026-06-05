// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars";
import { pmo } from "./pmo";

/**
 * Golden hash pinned against a 100-bar Mulberry32(seed=42) synthetic
 * walk over default opts (35, 20, 10). Hashes pmo first, then signal.
 */
describe("ta.pmo — golden", () => {
    it("matches the pinned hash for 100 bars × default opts (35, 20, 10)", () => {
        const bars = syntheticBars(100, 42);
        const ps: number[] = [];
        const ss: number[] = [];
        harness(bars, bars.length + 1, (bar) => {
            const p = pmo("slot", bar.close);
            ps.push(p.pmo.current);
            ss.push(p.signal.current);
            return null;
        });
        const combined = [...ps, ...ss];
        // Captured on first deterministic green run.
        expect(hashFloat64Array(combined)).toBe("d18c9fbe");
    });
});
