// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { dmi } from "./dmi";
import { benchHotLoop } from "./__fixtures__/benchHotLoop";

describe("ta.dmi hot loop", () => {
    bench(
        "ta.dmi over 10 000 bars × length=14",
        () => {
            const sink = benchHotLoop(10_000, 1, () => dmi("slot", 14).plusDi.current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
