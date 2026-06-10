// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { dmi } from "./dmi.js";
import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon. DMI is one
// Wilder-step recurrence per bar (constant work) over 10k bars; pair
// with `atr` / `rsi` baselines at 200 ms.
const THRESHOLD_MS = 1500;

describe("ta.dmi threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, () => dmi("slot", 14).plusDi.current);
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
