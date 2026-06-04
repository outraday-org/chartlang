// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars";
import { sma } from "./sma";

/**
 * Golden hash pinned against a 100-bar Mulberry32(seed=42) synthetic
 * walk. Task 12 retargets to `packages/conformance/fixtures/
 * goldenBars.json` once that fixture lands; the contract — deterministic
 * primitive output pinned to a hex hash — is identical.
 */
describe("ta.sma — golden", () => {
    it("matches the pinned hash for 100 bars × length=10", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(bars, bars.length + 1, (bar) => sma("slot", bar.close, 10).current);
        const h = hashFloat64Array(out);
        expect(h).toBe("bbb69e2b");
    });
});
