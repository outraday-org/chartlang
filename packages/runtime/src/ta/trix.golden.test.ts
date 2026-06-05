// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { trix } from "./trix";
import { harness } from "./__fixtures__/runPrimitive";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars";

describe("ta.trix — golden", () => {
    it("matches the pinned hashes for 100 bars × length=18, signal=9", () => {
        const bars = syntheticBars(100, 42);
        const out = harness(bars, bars.length + 1, (bar) => {
            const r = trix("slot", bar.close, 18);
            return { trix: r.trix.current, signal: r.signal.current };
        });
        // Hashes captured during implementation against syntheticBars(100, 42);
        // re-pin if the math intentionally changes.
        expect(hashFloat64Array(out.map((o) => o.trix))).toBe("f6264174");
        expect(hashFloat64Array(out.map((o) => o.signal))).toBe("fedee0dd");
    });
});
