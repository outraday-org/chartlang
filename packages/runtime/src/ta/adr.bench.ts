// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { adr } from "./adr";
import { benchHotLoop } from "./__fixtures__/benchHotLoop";

describe("ta.adr hot loop", () => {
    bench(
        "ta.adr over 10 000 bars × length=14",
        () => {
            const sink = benchHotLoop(10_000, 1, () => adr("slot", { length: 14 }).current);
            // ADR over 1m synthetic bars yields a single committed UTC
            // day for the whole 10k bars (~7 days) and most outputs are
            // NaN; the sink may legitimately be 0 here.
            void sink;
        },
        { iterations: 5 },
    );
});
