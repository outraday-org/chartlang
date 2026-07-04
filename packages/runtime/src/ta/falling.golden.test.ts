// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { hashBoolArray, syntheticBars } from "./__fixtures__/syntheticBars.js";
import { falling } from "./falling.js";

describe("ta.falling — golden", () => {
    it("matches the pinned hash for falling(close, 3) across 100 bars", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(bars, bars.length + 1, (bar) => falling("slot", bar.close, 3).current);
        expect(hashBoolArray(out)).toBe("21da5112");
    });
});
