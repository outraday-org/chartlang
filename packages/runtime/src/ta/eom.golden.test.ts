// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars";
import { eom } from "./eom";

describe("ta.eom — golden", () => {
    it("matches the pinned hash for 100 bars × length 14", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(bars, bars.length + 1, () => eom("slot", 14).current);
        // Captured on first deterministic green run.
        expect(hashFloat64Array(out)).toBe("2b104726");
    });
});
