// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { withPrefilledContext } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { anchoredVolumeProfile } from "./anchoredVolumeProfile";

// THRESHOLD_MS — coverage smoke guard only. The dedicated
// anchoredVolumeProfile.bench.ts case is the benchmark harness for the
// strict hot-path budget under pnpm bench:ci.
const THRESHOLD_MS = 1500;

describe("ta.anchoredVolumeProfile threshold", () => {
    it("stays under the 5,000-bar threshold", () => {
        const bars = syntheticBars(5_000);
        const anchor = bars[2_500].time;
        const elapsed = withPrefilledContext(bars, 5_100, () => {
            const started = performance.now();
            anchoredVolumeProfile("slot", { anchor, rowSize: 200 });
            return performance.now() - started;
        });
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
