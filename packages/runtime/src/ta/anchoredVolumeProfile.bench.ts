// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { withPrefilledContext } from "./__fixtures__/runPrimitive";
import { syntheticBars } from "./__fixtures__/syntheticBars";
import { anchoredVolumeProfile } from "./anchoredVolumeProfile";

describe("ta.anchoredVolumeProfile bench", () => {
    bench("5,000 bars anchored at bar 2,500", () => {
        const bars = syntheticBars(5_000);
        const anchor = bars[2_500].time;
        withPrefilledContext(bars, 5_100, () => {
            anchoredVolumeProfile("slot", { anchor, rowSize: 200 });
        });
    });
});
