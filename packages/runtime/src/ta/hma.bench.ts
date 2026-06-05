// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { hma } from "./hma";

describe("ta.hma hot loop", () => {
    bench(
        "ta.hma over 10 000 bars × length=21",
        () => {
            const sink = benchHotLoop(10_000, 1, (bar) => hma("slot", bar.close, 21).current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
