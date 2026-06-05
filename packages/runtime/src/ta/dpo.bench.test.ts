// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { dpo } from "./dpo";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon. DPO
// composes one `ta.sma` sub-slot (O(1) per bar via running sum) and
// does one O(1) per-bar source-window append + lookup. 10k bars
// finishes well under 300ms on CI Linux runners.
const THRESHOLD_MS = 300;

describe("ta.dpo threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, (bar) => dpo("slot", bar.close, 21).current);
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
