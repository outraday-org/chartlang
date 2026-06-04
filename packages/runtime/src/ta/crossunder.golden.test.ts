// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive";
import { hashBoolArray, syntheticBars } from "./__fixtures__/syntheticBars";
import { crossunder } from "./crossunder";
import { ema } from "./ema";

describe("ta.crossunder — golden", () => {
    it("matches the pinned hash for fastEMA crossing under slowEMA across 100 bars", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(bars, bars.length + 1, (bar) => {
            const fast = ema("fast", bar.close, 5);
            const slow = ema("slow", bar.close, 13);
            return crossunder("cross", fast.current, slow.current).current;
        });
        const h = hashBoolArray(out);
        expect(h).toBe("347225c7");
    });
});
