// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { vortex } from "./vortex";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon. Vortex is
// O(1) per close (rolling-sum windows) — same ballpark as ATR / DMI;
// pair with `dmi` baseline at 200ms.
const THRESHOLD_MS = 200;

describe("ta.vortex threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, () => vortex("slot", 14).plus.current);
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
