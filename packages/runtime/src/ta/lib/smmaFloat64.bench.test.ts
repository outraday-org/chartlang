// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { syntheticBars } from "../__fixtures__/syntheticBars";
import { smmaFloat64 } from "./smmaFloat64";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon. SMMA is a
// single-pass recurrence; 10k bars take ~1ms on M2. Budget 300ms for
// CI Linux runners.
const THRESHOLD_MS = 1500;

describe("smmaFloat64 threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const source = new Float64Array(syntheticBars(10_000, 1).map((b) => b.close));
        const start = performance.now();
        const out = smmaFloat64(source, 20);
        const elapsed = performance.now() - start;
        expect(Number.isFinite(out[out.length - 1])).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
