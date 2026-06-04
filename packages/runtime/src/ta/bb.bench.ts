// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { bb } from "./bb";

describe("ta.bb hot loop", () => {
    bench(
        "ta.bb over 10 000 bars × length=20",
        () => {
            const sink = benchHotLoop(10_000, 1, (bar) => bb("slot", bar.close, 20).upper.current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
