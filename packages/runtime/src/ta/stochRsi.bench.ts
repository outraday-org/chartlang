// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { stochRsi } from "./stochRsi";

describe("ta.stochRsi hot loop", () => {
    bench(
        "ta.stochRsi over 10 000 bars × default opts (14, 14, 3, 3)",
        () => {
            const sink = benchHotLoop(10_000, 1, (bar) => stochRsi("slot", bar.close).d.current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
