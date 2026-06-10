// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { williamsFractal } from "./williamsFractal.js";
import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";

describe("ta.williamsFractal hot loop", () => {
    bench(
        "ta.williamsFractal over 10 000 bars × default length=2",
        () => {
            const sink = benchHotLoop(10_000, 1, () => {
                const v = williamsFractal("slot").up.current;
                return Number.isFinite(v) ? v : 0;
            });
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
