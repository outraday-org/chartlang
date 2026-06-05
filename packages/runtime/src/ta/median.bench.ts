// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { median } from "./median";

describe("ta.median hot loop", () => {
    bench(
        "ta.median over 10 000 bars × length=21",
        () => {
            const sink = benchHotLoop(10_000, 1, (bar) => median("slot", bar.close, 21).current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
