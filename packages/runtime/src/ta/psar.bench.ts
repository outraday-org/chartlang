// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";
import { psar } from "./psar.js";

describe("ta.psar hot loop", () => {
    bench(
        "ta.psar over 10 000 bars × default opts",
        () => {
            const sink = benchHotLoop(10_000, 1, () => psar("slot").sar.current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
