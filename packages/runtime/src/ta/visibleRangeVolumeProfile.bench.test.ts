// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { visibleRangeVolumeProfile } from "./visibleRangeVolumeProfile";

const THRESHOLD_MS = 50;

describe("ta.visibleRangeVolumeProfile threshold", () => {
    it("runs a 5 000-bar profile under the invinite baseline threshold", () => {
        const bars = syntheticBars(5_000, 501);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () => null);
        const head = bars[bars.length - 1];
        const start = performance.now();
        tick(ctxRef, head, () => {
            visibleRangeVolumeProfile("slot", { rowSize: 200 });
        });
        expect(performance.now() - start).toBeLessThan(THRESHOLD_MS);
    });
});
