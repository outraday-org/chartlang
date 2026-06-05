// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars";
import { obv } from "./obv";

describe("ta.obv — golden", () => {
    it("matches the pinned hash for 100 bars × default", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(bars, bars.length + 1, () => obv("slot").current);
        const h = hashFloat64Array(out);
        expect(h).toBe("829d24d9");
    });
});
