// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { syntheticBars } from "../__fixtures__/syntheticBars.js";
import { monotonic } from "./monotonic.js";

// THRESHOLD_MS — ceil(median × 3). monotonic is an O(length) walk over a
// tiny window; 10k length-3 checks are sub-millisecond on M2. Budget
// 1500ms for CI Linux runners.
const THRESHOLD_MS = 1500;

describe("monotonic threshold", () => {
    it("runs 10 000 length-3 windows under threshold", () => {
        const source = new Float64Array(syntheticBars(10_000, 1).map((b) => b.close));
        const window = new Float64Array(4);
        const start = performance.now();
        let sink = 0;
        for (let i = 3; i < source.length; i += 1) {
            window[0] = source[i - 3];
            window[1] = source[i - 2];
            window[2] = source[i - 1];
            window[3] = source[i];
            if (monotonic(window, 3, 1)) sink += 1;
        }
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
