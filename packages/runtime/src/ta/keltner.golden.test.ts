// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars";
import { keltner } from "./keltner";

describe("ta.keltner — golden", () => {
    it("matches the pinned hashes for 100 bars × length=20, multiplier=2, maType=ema", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(bars, bars.length + 1, () => {
            const k = keltner("slot", { length: 20, multiplier: 2, maType: "ema" });
            return { u: k.upper.current, m: k.middle.current, l: k.lower.current };
        });
        // Hashes captured during implementation against
        // syntheticBars(100, 42); re-pin if the math intentionally changes.
        expect(hashFloat64Array(out.map((o) => o.u))).toBe("0f2bab70");
        expect(hashFloat64Array(out.map((o) => o.m))).toBe("8006e60d");
        expect(hashFloat64Array(out.map((o) => o.l))).toBe("6a24fe89");
    });
});
