// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars.js";
import { cum } from "./cum.js";

describe("ta.cum — golden", () => {
    it("matches the pinned hash for cum(volume) over 100 bars", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(bars, bars.length + 1, (bar) => cum("slot", bar.volume).current);
        const h = hashFloat64Array(out);
        expect(h).toBe("faa543ff");
    });
});
