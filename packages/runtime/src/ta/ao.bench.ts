// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { ao } from "./ao";

describe("ta.ao hot loop", () => {
    bench(
        "ta.ao over 10 000 bars × default (5/34)",
        () => {
            const sink = benchHotLoop(10_000, 1, (_bar) => ao("slot").current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
