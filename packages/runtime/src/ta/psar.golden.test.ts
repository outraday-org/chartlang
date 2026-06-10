// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars.js";
import { psar } from "./psar.js";

describe("ta.psar — golden", () => {
    it("matches the pinned hashes for 100 bars × default opts", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(bars, bars.length + 1, () => {
            const p = psar("slot");
            return { sar: p.sar.current, direction: p.direction.current };
        });
        // Hashes captured during implementation against
        // syntheticBars(100, 42) with default acc 0.02 / 0.02 / 0.2;
        // re-pin if the math intentionally changes.
        expect(hashFloat64Array(out.map((o) => o.sar))).toBe("a9bbab19");
        expect(hashFloat64Array(out.map((o) => o.direction))).toBe("eaf6bee9");
    });
});
