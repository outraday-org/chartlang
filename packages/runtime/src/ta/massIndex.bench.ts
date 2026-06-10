// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";
import { massIndex } from "./massIndex.js";

describe("ta.massIndex hot loop", () => {
    bench(
        "ta.massIndex over 10 000 bars × defaults",
        () => {
            const sink = benchHotLoop(10_000, 1, () => massIndex("slot").current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
