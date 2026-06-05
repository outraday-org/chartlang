// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { adl } from "./adl";

describe("ta.adl hot loop", () => {
    bench(
        "ta.adl over 10 000 bars",
        () => {
            const sink = benchHotLoop(10_000, 1, () => adl("slot").current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
