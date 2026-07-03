// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";
import { cross } from "./cross.js";

describe("ta.cross hot loop", () => {
    bench(
        "ta.cross over 10 000 bars vs constant 100",
        () => {
            const sink = benchHotLoop(10_000, 1, (bar) => cross("slot", bar.close, 100).current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
