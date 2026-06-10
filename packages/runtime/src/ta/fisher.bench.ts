// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";
import { fisher } from "./fisher.js";

describe("ta.fisher hot loop", () => {
    bench(
        "ta.fisher over 10 000 bars × length 9",
        () => {
            const sink = benchHotLoop(10_000, 1, (bar) => fisher("slot", 9).fisher.current);
            if (!Number.isFinite(sink) && !Number.isNaN(sink)) {
                throw new Error("unexpected sink");
            }
        },
        { iterations: 5 },
    );
});
