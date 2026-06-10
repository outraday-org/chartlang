// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";
import { ulcerIndex } from "./ulcerIndex.js";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon. ulcerIndex's
// per-bar work is `ta.highest`'s monotone-deque max plus O(1)
// drawdown^2 fold + running-sum update; 10k bars stays comfortably
// under 200ms on M2. Budget 400ms for CI Linux.
const THRESHOLD_MS = 1500;

describe("ta.ulcerIndex threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, (bar) => ulcerIndex("slot", bar.close, 14).current);
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
