// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { ichimoku } from "./ichimoku";

describe("ta.ichimoku hot loop", () => {
    bench(
        "ta.ichimoku over 10 000 bars × default (9, 26, 52, 26)",
        () => {
            const sink = benchHotLoop(10_000, 1, () => ichimoku("slot").tenkan.current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
