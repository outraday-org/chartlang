// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { withPrefilledContext } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { sessionVolumeProfile } from "./sessionVolumeProfile.js";

// THRESHOLD_MS — coverage smoke guard only. The dedicated
// sessionVolumeProfile.bench.ts case is the benchmark harness for the
// strict hot-path budget under pnpm bench:ci.
const THRESHOLD_MS = 1500;

describe("ta.sessionVolumeProfile threshold", () => {
    it("stays under the 5,000-bar / 5-session threshold", () => {
        const bars = syntheticBars(5_000);
        const sessionStart = bars[4_000].time;
        const elapsed = withPrefilledContext(bars, 5_100, () => {
            const started = performance.now();
            sessionVolumeProfile("slot", { sessionStart, rowSize: 200 });
            return performance.now() - started;
        });
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
