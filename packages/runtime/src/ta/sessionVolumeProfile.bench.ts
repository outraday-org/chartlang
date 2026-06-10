// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { withPrefilledContext } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { sessionVolumeProfile } from "./sessionVolumeProfile.js";

const BARS = syntheticBars(5_000);
const SESSION_START = BARS[4_000].time;

describe("ta.sessionVolumeProfile bench", () => {
    bench("5 000-bar session profile spanning 5 sessions", () => {
        withPrefilledContext(BARS, 5_100, () => {
            sessionVolumeProfile("slot", { sessionStart: SESSION_START, rowSize: 200 });
        });
    });
});
