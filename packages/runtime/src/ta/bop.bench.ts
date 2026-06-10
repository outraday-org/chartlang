// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";
import { bop } from "./bop.js";

describe("ta.bop hot loop", () => {
    bench(
        "ta.bop over 10 000 bars",
        () => {
            const sink = benchHotLoop(10_000, 1, () => bop("slot").current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
