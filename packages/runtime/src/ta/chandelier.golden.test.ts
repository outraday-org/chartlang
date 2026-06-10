// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { chandelier } from "./chandelier.js";
import { harness } from "./__fixtures__/runPrimitive.js";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars.js";

describe("ta.chandelier — golden", () => {
    it("matches the pinned hashes for 100 bars × length=22 / multiplier=3", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(bars, bars.length + 1, () => {
            const c = chandelier("slot", { length: 22, multiplier: 3 });
            return { long: c.long.current, short: c.short.current };
        });
        // Hashes captured during implementation against
        // syntheticBars(100, 42); re-pin if the math intentionally changes.
        expect(hashFloat64Array(out.map((o) => o.long))).toBe("705b0b0c");
        expect(hashFloat64Array(out.map((o) => o.short))).toBe("c3320a4e");
    });
});
