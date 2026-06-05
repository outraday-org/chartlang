// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { aroon } from "./aroon";
import { benchHotLoop } from "./__fixtures__/benchHotLoop";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon. Aroon scans
// a `length + 1` window per close (15 finite-checks × 2 series × 10k
// bars ≈ 300k ops); pair with `highest`/`change` baseline at 300ms.
const THRESHOLD_MS = 300;

describe("ta.aroon threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, () => aroon("slot", 14).up.current);
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
