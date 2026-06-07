// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { pmo } from "./pmo";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon. PMO chains
// two Swenlin EMA stages + one standard signal EMA — all O(1) per bar.
// 10k bars fits well under 300ms on CI Linux runners.
const THRESHOLD_MS = 1500;

describe("ta.pmo threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, (bar) => pmo("slot", bar.close).pmo.current);
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
