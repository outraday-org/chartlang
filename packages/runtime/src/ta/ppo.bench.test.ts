// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { ppo } from "./ppo";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon. PPO
// composes three `ta.ema` sub-slots — each O(1) per bar (recurrence).
// 10k bars × default opts (12, 26, 9) is ~30k EMA-step operations
// total; fits comfortably under 300ms on CI Linux runners.
const THRESHOLD_MS = 300;

describe("ta.ppo threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, (bar) => ppo("slot", bar.close).signal.current);
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
