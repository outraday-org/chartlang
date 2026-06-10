// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars.js";
import { vortex } from "./vortex.js";

describe("ta.vortex — golden", () => {
    it("matches the pinned hashes for 100 bars × length=14", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(bars, bars.length + 1, () => {
            const v = vortex("slot", 14);
            return { plus: v.plus.current, minus: v.minus.current };
        });
        // Hashes captured during implementation against
        // syntheticBars(100, 42); re-pin if the math intentionally changes.
        expect(hashFloat64Array(out.map((o) => o.plus))).toBe("406480ec");
        expect(hashFloat64Array(out.map((o) => o.minus))).toBe("7fad591c");
    });
});
