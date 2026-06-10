// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars.js";
import { smi } from "./smi.js";

/**
 * Golden hash pinned against a 100-bar Mulberry32(seed=42) synthetic
 * walk over default opts (10, 3, 5, 3). Hashes smi first, then signal.
 */
describe("ta.smi — golden", () => {
    it("matches the pinned hash for 100 bars × default opts (10, 3, 5, 3)", () => {
        const bars = syntheticBars(100, 42);
        const ms: number[] = [];
        const ss: number[] = [];
        harness(bars, bars.length + 1, (bar) => {
            const s = smi("slot");
            ms.push(s.smi.current);
            ss.push(s.signal.current);
            return null;
        });
        const combined = [...ms, ...ss];
        // Captured on first deterministic green run.
        expect(hashFloat64Array(combined)).toBe("c917e7aa");
    });
});
