// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { hashBoolArray, syntheticBars } from "./__fixtures__/syntheticBars.js";
import { rising } from "./rising.js";

describe("ta.rising — golden", () => {
    it("matches the pinned hash for rising(close, 3) across 100 bars", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(bars, bars.length + 1, (bar) => rising("slot", bar.close, 3).current);
        expect(hashBoolArray(out)).toBe("f8faab4d");
    });
});
