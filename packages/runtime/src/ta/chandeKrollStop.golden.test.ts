// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { chandeKrollStop } from "./chandeKrollStop";
import { harness } from "./__fixtures__/runPrimitive";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars";

describe("ta.chandeKrollStop — golden", () => {
    it("matches the pinned hashes for 100 bars × defaults", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(bars, bars.length + 1, () => {
            const c = chandeKrollStop("slot");
            return { long: c.long.current, short: c.short.current };
        });
        // Hashes captured during implementation against
        // syntheticBars(100, 42); re-pin if the math intentionally changes.
        expect(hashFloat64Array(out.map((o) => o.long))).toBe("cc706669");
        expect(hashFloat64Array(out.map((o) => o.short))).toBe("19e9c4e5");
    });
});
