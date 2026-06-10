// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars.js";
import { pivotsHighLow } from "./pivotsHighLow.js";

describe("ta.pivotsHighLow — golden", () => {
    it("matches the pinned hashes for 100 bars × leftLength=4 × rightLength=4", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(bars, bars.length + 1, () => {
            const p = pivotsHighLow("slot", { leftLength: 4, rightLength: 4 });
            return { high: p.high.current, low: p.low.current };
        });
        // Hashes captured during implementation against
        // syntheticBars(100, 42) with leftLength=4 / rightLength=4;
        // re-pin if the math intentionally changes.
        expect(hashFloat64Array(out.map((o) => o.high))).toBe("7ed6d4c5");
        expect(hashFloat64Array(out.map((o) => o.low))).toBe("58262c91");
    });
});
