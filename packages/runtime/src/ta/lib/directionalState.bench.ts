// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { syntheticBars } from "../__fixtures__/syntheticBars.js";
import { advanceDirectionalClose, initDirectionalState } from "./directionalState.js";

describe("advanceDirectionalClose hot loop", () => {
    const bars = syntheticBars(10_000, 1);
    bench(
        "advanceDirectionalClose over 10 000 bars × length=14",
        () => {
            const s = initDirectionalState(14);
            for (let i = 0; i < bars.length; i += 1) {
                const b = bars[i];
                advanceDirectionalClose(s, b.high, b.low, b.close);
            }
            if (!Number.isFinite(s.plusDi)) {
                throw new Error("non-finite sink");
            }
        },
        { iterations: 5 },
    );
});
