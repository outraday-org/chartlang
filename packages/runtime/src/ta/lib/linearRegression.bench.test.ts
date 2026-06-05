// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { syntheticBars } from "../__fixtures__/syntheticBars";
import { linearRegression } from "./linearRegression";

const THRESHOLD_MS = 300;

describe("linearRegression threshold", () => {
    it("runs 10 000 bars × length=20 under threshold", () => {
        const n = 10_000;
        const bars = syntheticBars(n, 1);
        const source = new Float64Array(n);
        for (let i = 0; i < n; i += 1) source[i] = bars[i].close;
        const start = performance.now();
        const out = linearRegression(source, 20);
        const elapsed = performance.now() - start;
        expect(Number.isFinite(out.value[n - 1])).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
