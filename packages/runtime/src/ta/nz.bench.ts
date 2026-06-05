// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { syntheticBars } from "./__fixtures__/syntheticBars";
import { nz } from "./nz";

describe("ta.nz hot loop", () => {
    bench(
        "ta.nz over 10 000 bars with every 7th NaN",
        () => {
            const bars = syntheticBars(10_000, 1);
            let sink = 0;
            for (let i = 0; i < bars.length; i += 1) {
                const v = i % 7 === 0 ? Number.NaN : bars[i].close;
                sink += nz(v, 0);
            }
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
