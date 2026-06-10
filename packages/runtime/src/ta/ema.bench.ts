// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";
import { ema } from "./ema.js";

describe("ta.ema hot loop", () => {
    bench(
        "ta.ema over 10 000 bars × length=20",
        () => {
            const sink = benchHotLoop(10_000, 1, (bar) => ema("slot", bar.close, 20).current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
