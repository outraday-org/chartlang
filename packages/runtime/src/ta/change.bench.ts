// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { change } from "./change";

describe("ta.change hot loop", () => {
    bench(
        "ta.change over 10 000 bars × length=5",
        () => {
            const sink = benchHotLoop(
                10_000,
                1,
                (bar) => change("slot", bar.close, { length: 5 }).current,
            );
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
