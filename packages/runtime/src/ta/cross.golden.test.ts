// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { hashBoolArray, syntheticBars } from "./__fixtures__/syntheticBars.js";
import { cross } from "./cross.js";
import { ema } from "./ema.js";

describe("ta.cross — golden", () => {
    it("matches the pinned hash for fastEMA crossing slowEMA across 100 bars", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(bars, bars.length + 1, (bar) => {
            const fast = ema("fast", bar.close, 5);
            const slow = ema("slow", bar.close, 13);
            return cross("cross", fast.current, slow.current).current;
        });
        const h = hashBoolArray(out);
        expect(h).toBe("6c9c9195");
    });
});
