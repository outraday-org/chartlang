// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars";
import { donchian } from "./donchian";

describe("ta.donchian — golden", () => {
    it("matches the pinned hashes for 100 bars × length=20", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(bars, bars.length + 1, () => {
            const d = donchian("slot", 20);
            return { u: d.upper.current, m: d.middle.current, l: d.lower.current };
        });
        // Hashes captured during implementation against
        // syntheticBars(100, 42); re-pin if the math intentionally changes.
        expect(hashFloat64Array(out.map((o) => o.u))).toBe("59780257");
        expect(hashFloat64Array(out.map((o) => o.m))).toBe("5c656c43");
        expect(hashFloat64Array(out.map((o) => o.l))).toBe("68ffa0fa");
    });
});
