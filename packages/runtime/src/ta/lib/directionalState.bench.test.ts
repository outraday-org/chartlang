// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { syntheticBars } from "../__fixtures__/syntheticBars.js";
import { advanceDirectionalClose, initDirectionalState } from "./directionalState.js";

const THRESHOLD_MS = 1500;

describe("advanceDirectionalClose threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const bars = syntheticBars(10_000, 1);
        const s = initDirectionalState(14);
        const start = performance.now();
        for (let i = 0; i < bars.length; i += 1) {
            const b = bars[i];
            advanceDirectionalClose(s, b.high, b.low, b.close);
        }
        const elapsed = performance.now() - start;
        expect(Number.isFinite(s.plusDi)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
