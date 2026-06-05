// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { ulcerIndex } from "./ulcerIndex";

describe("ta.ulcerIndex hot loop", () => {
    bench(
        "ta.ulcerIndex over 10 000 bars × length=14",
        () => {
            const sink = benchHotLoop(
                10_000,
                1,
                (bar) => ulcerIndex("slot", bar.close, 14).current,
            );
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
