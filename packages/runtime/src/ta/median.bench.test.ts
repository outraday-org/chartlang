// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { median } from "./median";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon. The per-bar
// sort over a 21-slot Float64Array view is the dominant cost (~O(L log
// L) per bar); 10k bars × length=21 stays well under 200ms on M2.
// Budget 500ms for CI Linux.
const THRESHOLD_MS = 1500;

describe("ta.median threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, (bar) => median("slot", bar.close, 21).current);
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
