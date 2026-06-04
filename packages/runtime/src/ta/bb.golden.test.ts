// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars";
import { bb } from "./bb";

describe("ta.bb — golden", () => {
    it("matches the pinned hashes for 100 bars × length=20", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(bars, bars.length + 1, (bar) => {
            const r = bb("slot", bar.close, 20, { multiplier: 2 });
            return { u: r.upper.current, m: r.middle.current, l: r.lower.current };
        });
        expect(hashFloat64Array(out.map((o) => o.u))).toBe("78799097");
        expect(hashFloat64Array(out.map((o) => o.m))).toBe("d8cd346b");
        expect(hashFloat64Array(out.map((o) => o.l))).toBe("3260f3d5");
    });
});
