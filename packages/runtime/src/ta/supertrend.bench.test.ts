// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { supertrend } from "./supertrend";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon. Supertrend
// runs O(1) per bar plus a composed `ta.atr` (also O(1)); pair with
// `aroon` / `change` baseline at 300ms.
const THRESHOLD_MS = 1500;

describe("ta.supertrend threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(
            10_000,
            1,
            () => supertrend("slot", { length: 10, multiplier: 3 }).line.current,
        );
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
