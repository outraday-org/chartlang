// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";
import { cci } from "./cci.js";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon. CCI's per-
// close mean-abs-dev rescan is O(length); 10k × 20 ~ 200k operations
// fits comfortably under 300ms on CI Linux runners.
const THRESHOLD_MS = 1500;

describe("ta.cci threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(
            10_000,
            1,
            (bar) => cci("slot", (bar.high + bar.low + bar.close) / 3, 20).current,
        );
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
