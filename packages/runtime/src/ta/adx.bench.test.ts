// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { adx } from "./adx";
import { benchHotLoop } from "./__fixtures__/benchHotLoop";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon. ADX folds
// the DMI recurrence + a second Wilder-step over DX; total work per
// bar is constant. Pair with `dmi` baseline at 250 ms.
const THRESHOLD_MS = 1500;

describe("ta.adx threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, () => adx("slot", 14).current);
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
