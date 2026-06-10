// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";
import { smi } from "./smi.js";

describe("ta.smi hot loop", () => {
    bench(
        "ta.smi over 10 000 bars × default opts (10, 3, 5, 3)",
        () => {
            const sink = benchHotLoop(10_000, 1, () => smi("slot").smi.current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
