// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { vwap } from "./vwap";

describe("ta.vwap hot loop", () => {
    bench(
        "ta.vwap over 10 000 bars × hlc3",
        () => {
            const sink = benchHotLoop(10_000, 1, () => vwap("slot").current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
