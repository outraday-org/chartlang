// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { chandelier } from "./chandelier";
import { benchHotLoop } from "./__fixtures__/benchHotLoop";

describe("ta.chandelier hot loop", () => {
    bench(
        "ta.chandelier over 10 000 bars × length=22 / multiplier=3",
        () => {
            const sink = benchHotLoop(10_000, 1, () => chandelier("slot").long.current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
