// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { hma } from "./hma";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon. HMA composes
// three WMA sub-slots (half + full + final) — roughly 3× SMA's budget
// per task §10. Budget 500ms to absorb CI Linux variability.
const THRESHOLD_MS = 500;

describe("ta.hma threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, (bar) => hma("slot", bar.close, 21).current);
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
