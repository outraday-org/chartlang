// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { bench, describe } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { vortex } from "./vortex";

describe("ta.vortex hot loop", () => {
    bench(
        "ta.vortex over 10 000 bars × length=14",
        () => {
            const sink = benchHotLoop(10_000, 1, () => vortex("slot", 14).plus.current);
            if (!Number.isFinite(sink)) throw new Error("non-finite sink");
        },
        { iterations: 5 },
    );
});
