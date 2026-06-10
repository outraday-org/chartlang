// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { withPrefilledContext } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { fixedRangeVolumeProfile } from "./fixedRangeVolumeProfile.js";

describe("ta.fixedRangeVolumeProfile bench", () => {
    bench("5,000 bars over range 1,000-4,000", () => {
        const bars = syntheticBars(5_000);
        withPrefilledContext(bars, 5_100, () => {
            fixedRangeVolumeProfile("slot", {
                from: bars[1_000].time,
                to: bars[4_000].time,
                rowSize: 200,
            });
        });
    });
});
