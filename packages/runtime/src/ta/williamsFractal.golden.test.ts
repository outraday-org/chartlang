// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { williamsFractal } from "./williamsFractal";
import { harness } from "./__fixtures__/runPrimitive";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars";

describe("ta.williamsFractal — golden", () => {
    it("matches the pinned hashes for 100 bars × default length=2", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(bars, bars.length + 1, () => {
            const f = williamsFractal("slot");
            return { up: f.up.current, down: f.down.current };
        });
        // Hashes captured during implementation against
        // syntheticBars(100, 42); re-pin if the math intentionally changes.
        // Most slots are NaN (fractals are sparse); hash is deterministic.
        expect(hashFloat64Array(out.map((o) => o.up))).toBe("1d0b6ead");
        expect(hashFloat64Array(out.map((o) => o.down))).toBe("d2c7ff52");
    });
});
