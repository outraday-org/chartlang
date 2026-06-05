// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { pvt } from "./pvt";

describe("ta.pvt hot loop", () => {
    bench(
        "ta.pvt over 10 000 bars",
        () => {
            const sink = benchHotLoop(10_000, 1, () => pvt("slot").current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
