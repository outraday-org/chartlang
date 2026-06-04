// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { macd } from "./macd";

describe("ta.macd hot loop", () => {
    bench(
        "ta.macd over 10 000 bars × default lengths",
        () => {
            const sink = benchHotLoop(10_000, 1, (bar) => macd("slot", bar.close).macd.current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
