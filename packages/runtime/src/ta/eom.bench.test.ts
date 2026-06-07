// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { eom } from "./eom";

// THRESHOLD_MS — ceil(median × 3). ta.eom is one running-sum update +
// nanCount adjustment per bar (no window re-walk) — well under the
// 300 ms ceiling over 10k bars at length 14.
const THRESHOLD_MS = 1500;

describe("ta.eom threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, () => eom("slot", 14).current);
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
