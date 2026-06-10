// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";
import { zigZag } from "./zigZag.js";

describe("ta.zigZag hot loop", () => {
    bench(
        "ta.zigZag over 10 000 bars × deviation=5 × depth=10",
        () => {
            const sink = benchHotLoop(10_000, 1, () => {
                const z = zigZag("slot", { deviation: 5, depth: 10 });
                const v = z.value.current;
                return Number.isFinite(v) ? v : 0;
            });
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
