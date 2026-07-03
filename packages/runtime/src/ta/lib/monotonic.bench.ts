// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { syntheticBars } from "../__fixtures__/syntheticBars.js";
import { monotonic } from "./monotonic.js";

const SOURCE = new Float64Array(syntheticBars(10_000, 1).map((b) => b.close));

describe("monotonic hot loop", () => {
    bench(
        "monotonic over 10 000 windows × length=3",
        () => {
            let sink = 0;
            const window = new Float64Array(4);
            for (let i = 3; i < SOURCE.length; i += 1) {
                window[0] = SOURCE[i - 3];
                window[1] = SOURCE[i - 2];
                window[2] = SOURCE[i - 1];
                window[3] = SOURCE[i];
                if (monotonic(window, 3, 1)) sink += 1;
            }
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 10 },
    );
});
