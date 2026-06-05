// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { supertrend } from "./supertrend";

describe("ta.supertrend hot loop", () => {
    bench(
        "ta.supertrend over 10 000 bars × length=10 × multiplier=3",
        () => {
            const sink = benchHotLoop(
                10_000,
                1,
                () => supertrend("slot", { length: 10, multiplier: 3 }).line.current,
            );
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
