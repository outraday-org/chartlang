// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars";
import { median } from "./median";

describe("ta.median — golden", () => {
    it("matches the pinned hash for 100 bars × length=21", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(bars, bars.length + 1, (bar) => median("slot", bar.close, 21).current);
        const h = hashFloat64Array(out);
        // Pinned via the first deterministic run on this fixture; re-pin
        // when the math intentionally changes.
        expect(h).toBe("b40563ec");
    });
});
