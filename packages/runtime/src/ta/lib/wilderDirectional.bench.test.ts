// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { syntheticBars } from "../__fixtures__/syntheticBars.js";
import { wilderDirectional } from "./wilderDirectional.js";

const THRESHOLD_MS = 1500;

describe("wilderDirectional threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const n = 10_000;
        const bars = syntheticBars(n, 1);
        const high = new Float64Array(n);
        const low = new Float64Array(n);
        const close = new Float64Array(n);
        for (let i = 0; i < n; i += 1) {
            high[i] = bars[i].high;
            low[i] = bars[i].low;
            close[i] = bars[i].close;
        }
        const start = performance.now();
        const out = wilderDirectional(high, low, close, 14);
        const elapsed = performance.now() - start;
        expect(Number.isFinite(out.plusDi[out.plusDi.length - 1])).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
