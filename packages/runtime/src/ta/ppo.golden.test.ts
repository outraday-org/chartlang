// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars";
import { ppo } from "./ppo";

/**
 * Golden hash pinned against a 100-bar Mulberry32(seed=42) synthetic
 * walk over default opts (12, 26, 9). The hash covers the
 * concatenation of ppo, signal, and hist Series outputs.
 */
describe("ta.ppo — golden", () => {
    it("matches the pinned hash for 100 bars × default opts (12, 26, 9)", () => {
        const bars = syntheticBars(100, 42);
        const ppos: number[] = [];
        const signals: number[] = [];
        const hists: number[] = [];
        harness(bars, bars.length + 1, (bar) => {
            const p = ppo("slot", bar.close);
            ppos.push(p.ppo.current);
            signals.push(p.signal.current);
            hists.push(p.hist.current);
            return null;
        });
        const combined = [...ppos, ...signals, ...hists];
        // Captured on first deterministic green run.
        expect(hashFloat64Array(combined)).toBe("67897cf2");
    });
});
