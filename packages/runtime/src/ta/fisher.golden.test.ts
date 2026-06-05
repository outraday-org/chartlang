// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars";
import { fisher } from "./fisher";

describe("ta.fisher — golden", () => {
    it("matches the pinned hash for 100 bars × length 9", () => {
        const bars = syntheticBars(100, 42);
        const fs: number[] = [];
        const ts: number[] = [];
        harness(bars, bars.length + 1, (bar) => {
            const f = fisher("slot", 9);
            fs.push(f.fisher.current);
            ts.push(f.trigger.current);
            return null;
        });
        expect(hashFloat64Array([...fs, ...ts])).toBe("c6e2cd91");
    });
});
