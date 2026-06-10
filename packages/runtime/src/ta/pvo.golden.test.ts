// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars.js";
import { pvo } from "./pvo.js";

/**
 * Golden hash pinned against a 100-bar Mulberry32(seed=42) synthetic
 * walk over default opts (12, 26, 9). The hash covers the
 * concatenation of pvo, signal, and hist Series outputs.
 */
describe("ta.pvo — golden", () => {
    it("matches the pinned hash for 100 bars × default opts (12, 26, 9)", () => {
        const bars = syntheticBars(100, 42);
        const pvos: number[] = [];
        const signals: number[] = [];
        const hists: number[] = [];
        harness(bars, bars.length + 1, () => {
            const p = pvo("slot");
            pvos.push(p.pvo.current);
            signals.push(p.signal.current);
            hists.push(p.hist.current);
            return null;
        });
        const combined = [...pvos, ...signals, ...hists];
        // Captured on first deterministic green run.
        expect(hashFloat64Array(combined)).toBe("89e61821");
    });
});
