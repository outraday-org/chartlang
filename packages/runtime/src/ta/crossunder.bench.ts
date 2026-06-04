// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { crossunder } from "./crossunder";

describe("ta.crossunder hot loop", () => {
    bench(
        "ta.crossunder over 10 000 bars vs constant 100",
        () => {
            const sink = benchHotLoop(
                10_000,
                1,
                (bar) => crossunder("slot", bar.close, 100).current,
            );
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
