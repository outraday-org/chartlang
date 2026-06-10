// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { anchoredVwap } from "./anchoredVwap.js";
import { harness } from "./__fixtures__/runPrimitive.js";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars.js";

describe("ta.anchoredVwap — golden", () => {
    it("matches the pinned hash for 100 bars × anchor at bar 0", () => {
        const bars = syntheticBars(100, 42);
        const anchor = bars[0].time;
        const out = harness(bars, bars.length + 1, () => anchoredVwap("slot", anchor).current);
        const h = hashFloat64Array(out);
        // Same hash as `ta.vwap` since `syntheticBars`'s base time
        // (`1_700_000_000_000`) lands inside a single UTC day across all
        // 100 bars — there's no session reset, so an anchor at bar 0
        // produces the identical accumulator trajectory.
        expect(h).toBe("8c2dc73b");
    });
});
