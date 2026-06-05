// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars";
import { bbw } from "./bbw";

describe("ta.bbw — golden", () => {
    it("matches the pinned hash for 100 bars × length=20", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(bars, bars.length + 1, (bar) => bbw("slot", bar.close, 20).current);
        // Hash captured during implementation against syntheticBars(100, 42);
        // re-pin if the math intentionally changes.
        expect(hashFloat64Array(out)).toBe("2e43558d");
    });
});
