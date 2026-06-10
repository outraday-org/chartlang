// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars.js";
import { zigZag } from "./zigZag.js";

describe("ta.zigZag — golden", () => {
    it("matches the pinned hashes for 100 bars × deviation=5 × depth=10", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(bars, bars.length + 1, () => {
            const z = zigZag("slot", { deviation: 5, depth: 10 });
            return { value: z.value.current, direction: z.direction.current };
        });
        // Hashes captured during implementation against
        // syntheticBars(100, 42) with deviation=5 / depth=10;
        // re-pin if the math intentionally changes.
        expect(hashFloat64Array(out.map((o) => o.value))).toBe("c26d6dc4");
        expect(hashFloat64Array(out.map((o) => o.direction))).toBe("1653ef9c");
    });
});
