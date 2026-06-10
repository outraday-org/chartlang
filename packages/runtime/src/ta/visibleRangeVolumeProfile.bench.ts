// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { visibleRangeVolumeProfile } from "./visibleRangeVolumeProfile.js";

const BARS = syntheticBars(5_000, 501);
const { ctxRef } = harnessWithCtx(BARS, BARS.length + 1, () => null);
const HEAD = BARS[BARS.length - 1];

describe("ta.visibleRangeVolumeProfile bench", () => {
    bench("5 000-bar visible-range profile", () => {
        tick(ctxRef, HEAD, () => {
            visibleRangeVolumeProfile("slot", { rowSize: 200 });
        });
    });
});
