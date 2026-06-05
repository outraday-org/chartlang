// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars";
import { ao } from "./ao";

describe("ta.ao — golden", () => {
    it("matches the pinned hash for 100 bars × default (5/34)", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(bars, bars.length + 1, (_bar) => ao("slot").current);
        const h = hashFloat64Array(out);
        expect(h).toBe("aea54a2e");
    });
});
