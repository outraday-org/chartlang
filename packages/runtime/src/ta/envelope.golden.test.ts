// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars.js";
import { envelope } from "./envelope.js";

describe("ta.envelope — golden", () => {
    it("matches the pinned hashes for 100 bars × length=20, percent=10, maType=sma", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(bars, bars.length + 1, (b) => {
            const e = envelope("slot", b.close, { length: 20, percent: 10, maType: "sma" });
            return { u: e.upper.current, m: e.middle.current, l: e.lower.current };
        });
        // Hashes captured during implementation against
        // syntheticBars(100, 42); re-pin if the math intentionally changes.
        expect(hashFloat64Array(out.map((o) => o.u))).toBe("b1343c66");
        expect(hashFloat64Array(out.map((o) => o.m))).toBe("d8cd346b");
        expect(hashFloat64Array(out.map((o) => o.l))).toBe("bd8a0517");
    });
});
