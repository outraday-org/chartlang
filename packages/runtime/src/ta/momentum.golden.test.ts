// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars.js";
import { momentum } from "./momentum.js";

describe("ta.momentum — golden", () => {
    it("matches the pinned hash for 100 bars × length=10", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => momentum("slot", bar.close, 10).current,
        );
        const h = hashFloat64Array(out);
        expect(h).toBe("d6bff916");
    });
});
