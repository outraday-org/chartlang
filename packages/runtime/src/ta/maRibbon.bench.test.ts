// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";
import { maRibbon } from "./maRibbon.js";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon. 10k bars
// through 5 SMA sub-slots (default lengths) — ~K× single-MA cost.
const THRESHOLD_MS = 1500;

describe("ta.maRibbon threshold", () => {
    it("runs 10 000 bars under threshold (default lengths)", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, (bar) => {
            const r = maRibbon("slot", bar.close);
            return r.ma_10.current + r.ma_50.current;
        });
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
