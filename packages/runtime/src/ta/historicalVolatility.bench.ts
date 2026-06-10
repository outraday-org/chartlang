// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";
import { historicalVolatility } from "./historicalVolatility.js";

describe("ta.historicalVolatility hot loop", () => {
    bench(
        "ta.historicalVolatility over 10 000 bars × length=10",
        () => {
            const sink = benchHotLoop(
                10_000,
                1,
                (bar) => historicalVolatility("slot", bar.close, 10).current,
            );
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
