// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars.js";
import { cci } from "./cci.js";

/**
 * Golden hash pinned against a 100-bar Mulberry32(seed=42) synthetic
 * walk. Captured on first deterministic run; Task 12 retargets to
 * `packages/conformance/fixtures/goldenBars.json` once that fixture
 * lands.
 */
describe("ta.cci — golden", () => {
    it("matches the pinned hash for 100 bars × length=20", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(
            bars,
            bars.length + 1,
            (bar) => cci("slot", (bar.high + bar.low + bar.close) / 3, 20).current,
        );
        const h = hashFloat64Array(out);
        expect(h).toBe("efb01bf8");
    });
});
